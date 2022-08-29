import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import { cloneDeep } from 'lodash';
import { Collection, Map as OpenLayersMap, MapBrowserEvent, PluggableMap, View } from 'ol';
import { FeatureLike } from 'ol/Feature';
import Attribution from 'ol/control/Attribution';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import { Coordinate } from 'ol/coordinate';
import { isEmpty } from 'ol/extent';
import { defaults as interactionDefaults } from 'ol/interaction';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import BaseLayer from 'ol/layer/Base';
import { fromLonLat, toLonLat } from 'ol/proj';
import React, { Component, ReactNode } from 'react';
import { Subject, Subscription } from 'rxjs';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  FrameGeometrySourceMode,
  getFrameMatchers,
  GrafanaTheme,
  MapLayerHandler,
  MapLayerOptions,
  PanelData,
  PanelProps,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { PanelContext, PanelContextRoot, stylesFactory } from '@grafana/ui';
import { PanelEditExitedEvent } from 'app/types/events';

import { GeomapOverlay, OverlayProps } from './GeomapOverlay';
import { GeomapTooltip } from './GeomapTooltip';
import { DebugOverlay } from './components/DebugOverlay';
import { MeasureOverlay } from './components/MeasureOverlay';
import { GeomapHoverPayload, GeomapLayerHover } from './event';
import { getGlobalStyles } from './globalStyles';
import { defaultMarkersConfig, MARKERS_LAYER_ID } from './layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from './layers/registry';
import { ControlsOptions, GeomapPanelOptions, MapLayerState, MapViewConfig, TooltipMode } from './types';
import { getLayersExtent } from './utils/getLayersExtent';
import { centerPointRegistry, MapCenterID } from './view';

// Allows multiple panels to share the same view instance
let sharedView: View | undefined = undefined;

type Props = PanelProps<GeomapPanelOptions>;
interface State extends OverlayProps {
  ttip?: GeomapHoverPayload;
  ttipOpen: boolean;
  legends: ReactNode[];
  measureMenuActive?: boolean;
}

export interface GeomapLayerActions {
  selectLayer: (uid: string) => void;
  deleteLayer: (uid: string) => void;
  addlayer: (type: string) => void;
  reorder: (src: number, dst: number) => void;
  canRename: (v: string) => boolean;
}

export interface GeomapInstanceState {
  map?: OpenLayersMap;
  layers: MapLayerState[];
  selected: number;
  actions: GeomapLayerActions;
}

export class GeomapPanel extends Component<Props, State> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;
  private subs = new Subscription();

  globalCSS = getGlobalStyles(config.theme2);

  mouseWheelZoom?: MouseWheelZoom;
  style = getStyles(config.theme);
  hoverPayload: GeomapHoverPayload = { point: {}, pageX: -1, pageY: -1 };
  readonly hoverEvent = new DataHoverEvent(this.hoverPayload);

  map?: OpenLayersMap;
  mapDiv?: HTMLDivElement;
  layers: MapLayerState[] = [];
  readonly byName = new Map<string, MapLayerState>();

  constructor(props: Props) {
    super(props);
    this.state = { ttipOpen: false, legends: [] };
    this.subs.add(
      this.props.eventBus.subscribe(PanelEditExitedEvent, (evt) => {
        if (this.mapDiv && this.props.id === evt.payload) {
          this.initMapRef(this.mapDiv);
        }
      })
    );
  }

  componentDidMount() {
    this.panelContext = this.context as PanelContext;
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
    for (const lyr of this.layers) {
      lyr.handler.dispose?.();
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    if (!this.map) {
      return true; // not yet initialized
    }

    // Check for resize
    if (this.props.height !== nextProps.height || this.props.width !== nextProps.width) {
      this.map.updateSize();
    }

    // External data changed
    if (this.props.data !== nextProps.data) {
      this.dataChanged(nextProps.data);
    }

    // Options changed
    if (this.props.options !== nextProps.options) {
      this.optionsChanged(nextProps.options);
    }

    return true; // always?
  }

  componentDidUpdate(prevProps: Props) {
    if (this.map && (this.props.height !== prevProps.height || this.props.width !== prevProps.width)) {
      this.map.updateSize();
    }
    // Check for a difference between previous data and component data
    if (this.map && this.props.data !== prevProps.data) {
      this.dataChanged(this.props.data);
    }
  }

  /** This function will actually update the JSON model */
  private doOptionsUpdate(selected: number) {
    const { options, onOptionsChange } = this.props;
    const layers = this.layers;
    onOptionsChange({
      ...options,
      basemap: layers[0].options,
      layers: layers.slice(1).map((v) => v.options),
    });

    // Notify the panel editor
    if (this.panelContext.onInstanceStateChange) {
      this.panelContext.onInstanceStateChange({
        map: this.map,
        layers: layers,
        selected,
        actions: this.actions,
      });
    }

    this.setState({ legends: this.getLegends() });
  }

  getNextLayerName = () => {
    let idx = this.layers.length; // since basemap is 0, this looks right
    while (true && idx < 100) {
      const name = `Layer ${idx++}`;
      if (!this.byName.has(name)) {
        return name;
      }
    }
    return `Layer ${Date.now()}`;
  };

  actions: GeomapLayerActions = {
    selectLayer: (uid: string) => {
      const selected = this.layers.findIndex((v) => v.options.name === uid);
      if (this.panelContext.onInstanceStateChange) {
        this.panelContext.onInstanceStateChange({
          map: this.map,
          layers: this.layers,
          selected,
          actions: this.actions,
        });
      }
    },
    canRename: (v: string) => {
      return !this.byName.has(v);
    },
    deleteLayer: (uid: string) => {
      const layers: MapLayerState[] = [];
      for (const lyr of this.layers) {
        if (lyr.options.name === uid) {
          this.map?.removeLayer(lyr.layer);
        } else {
          layers.push(lyr);
        }
      }
      this.layers = layers;
      this.doOptionsUpdate(0);
    },
    addlayer: (type: string) => {
      const item = geomapLayerRegistry.getIfExists(type);
      if (!item) {
        return; // ignore empty request
      }
      this.initLayer(
        this.map!,
        {
          type: item.id,
          name: this.getNextLayerName(),
          config: cloneDeep(item.defaultOptions),
          location: item.showLocation ? { mode: FrameGeometrySourceMode.Auto } : undefined,
          tooltip: true,
        },
        false
      ).then((lyr) => {
        this.layers = this.layers.slice(0);
        this.layers.push(lyr);
        this.map?.addLayer(lyr.layer);

        this.doOptionsUpdate(this.layers.length - 1);
      });
    },
    reorder: (startIndex: number, endIndex: number) => {
      const result = Array.from(this.layers);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      this.layers = result;

      this.doOptionsUpdate(endIndex);

      // Add the layers in the right order
      const group = this.map?.getLayers()!;
      group.clear();
      this.layers.forEach((v) => group.push(v.layer));
    },
  };

  /**
   * Called when the panel options change
   *
   * NOTE: changes to basemap and layers are handled independently
   */
  optionsChanged(options: GeomapPanelOptions) {
    const oldOptions = this.props.options;
    if (options.view !== oldOptions.view) {
      this.map!.setView(this.initMapView(options.view, this.map!.getLayers()));
    }

    if (options.controls !== oldOptions.controls) {
      this.initControls(options.controls ?? { showZoom: true, showAttribution: true });
    }
  }

  /**
   * Called when PanelData changes (query results etc)
   */
  dataChanged(data: PanelData) {
    // Only update if panel data matches component data
    if (data === this.props.data) {
      for (const state of this.layers) {
        this.applyLayerFilter(state.handler, state.options);
      }
    }
  }

  initMapRef = async (div: HTMLDivElement) => {
    this.mapDiv = div;
    if (this.map) {
      this.map.dispose();
    }

    if (!div) {
      this.map = undefined as unknown as OpenLayersMap;
      return;
    }
    const { options } = this.props;

    const map = (this.map = new OpenLayersMap({
      view: this.initMapView(options.view, undefined),
      pixelRatio: 1, // or zoom?
      layers: [], // loaded explicitly below
      controls: [],
      target: div,
      interactions: interactionDefaults({
        mouseWheelZoom: false, // managed by initControls
      }),
    }));

    this.byName.clear();
    const layers: MapLayerState[] = [];
    try {
      layers.push(await this.initLayer(map, options.basemap ?? DEFAULT_BASEMAP_CONFIG, true));

      // Default layer values
      const layerOptions = options.layers ?? [defaultMarkersConfig];

      for (const lyr of layerOptions) {
        layers.push(await this.initLayer(map, lyr, false));
      }
    } catch (ex) {
      console.error('error loading layers', ex);
    }

    for (const lyr of layers) {
      map.addLayer(lyr.layer);
    }
    this.layers = layers;
    this.map = map; // redundant
    this.initViewExtent(map.getView(), options.view, map.getLayers());

    this.mouseWheelZoom = new MouseWheelZoom();
    this.map.addInteraction(this.mouseWheelZoom);
    this.initControls(options.controls);
    this.forceUpdate(); // first render

    // Tooltip listener
    this.map.on('singleclick', this.pointerClickListener);
    this.map.on('pointermove', this.pointerMoveListener);
    this.map.getViewport().addEventListener('mouseout', (evt) => {
      this.props.eventBus.publish(new DataHoverClearEvent());
    });

    // Notify the panel editor
    if (this.panelContext.onInstanceStateChange) {
      this.panelContext.onInstanceStateChange({
        map: this.map,
        layers: layers,
        selected: layers.length - 1, // the top layer
        actions: this.actions,
      });
    }

    this.setState({ legends: this.getLegends() });
  };

  clearTooltip = () => {
    if (this.state.ttip && !this.state.ttipOpen) {
      this.tooltipPopupClosed();
    }
  };

  tooltipPopupClosed = () => {
    this.setState({ ttipOpen: false, ttip: undefined });
  };

  pointerClickListener = (evt: MapBrowserEvent<UIEvent>) => {
    if (this.pointerMoveListener(evt)) {
      evt.preventDefault();
      evt.stopPropagation();
      this.mapDiv!.style.cursor = 'auto';
      this.setState({ ttipOpen: true });
    }
  };

  pointerMoveListener = (evt: MapBrowserEvent<UIEvent>) => {
    // If measure menu is open, bypass tooltip logic and display measuring mouse events
    if (this.state.measureMenuActive) {
      return true;
    }
    if (!this.map || this.state.ttipOpen) {
      return false;
    }
    const mouse = evt.originalEvent as MouseEvent;
    const pixel = this.map.getEventPixel(mouse);
    const hover = toLonLat(this.map.getCoordinateFromPixel(pixel));

    const { hoverPayload } = this;
    hoverPayload.pageX = mouse.pageX;
    hoverPayload.pageY = mouse.pageY;
    hoverPayload.point = {
      lat: hover[1],
      lon: hover[0],
    };
    hoverPayload.data = undefined;
    hoverPayload.columnIndex = undefined;
    hoverPayload.rowIndex = undefined;
    hoverPayload.layers = undefined;

    const layers: GeomapLayerHover[] = [];
    const layerLookup = new Map<MapLayerState, GeomapLayerHover>();

    let ttip: GeomapHoverPayload = {} as GeomapHoverPayload;
    this.map.forEachFeatureAtPixel(
      pixel,
      (feature, layer, geo) => {
        const s: MapLayerState = (layer as any).__state;
        //match hover layer to layer in layers
        //check if the layer show tooltip is enabled
        //then also pass the list of tooltip fields if exists
        //this is used as the generic hover event
        if (!hoverPayload.data) {
          const props = feature.getProperties();
          const frame = props['frame'];
          if (frame) {
            hoverPayload.data = ttip.data = frame as DataFrame;
            hoverPayload.rowIndex = ttip.rowIndex = props['rowIndex'];
          }

          if (s?.mouseEvents) {
            s.mouseEvents.next(feature);
          }
        }

        if (s) {
          let h = layerLookup.get(s);
          if (!h) {
            h = { layer: s, features: [] };
            layerLookup.set(s, h);
            layers.push(h);
          }
          h.features.push(feature);
        }
      },
      {
        layerFilter: (l) => {
          const hoverLayerState = (l as any).__state as MapLayerState;
          return hoverLayerState?.options?.tooltip !== false;
        },
      }
    );
    this.hoverPayload.layers = layers.length ? layers : undefined;
    this.props.eventBus.publish(this.hoverEvent);

    this.setState({ ttip: { ...hoverPayload } });

    if (!layers.length) {
      // clear mouse events
      this.layers.forEach((layer) => {
        layer.mouseEvents.next(undefined);
      });
    }

    const found = layers.length ? true : false;
    this.mapDiv!.style.cursor = found ? 'pointer' : 'auto';
    return found;
  };

  private updateLayer = async (uid: string, newOptions: MapLayerOptions): Promise<boolean> => {
    if (!this.map) {
      return false;
    }
    const current = this.byName.get(uid);
    if (!current) {
      return false;
    }

    let layerIndex = -1;
    const group = this.map?.getLayers()!;
    for (let i = 0; i < group?.getLength(); i++) {
      if (group.item(i) === current.layer) {
        layerIndex = i;
        break;
      }
    }

    // Special handling for rename
    if (newOptions.name !== uid) {
      if (!newOptions.name) {
        newOptions.name = uid;
      } else if (this.byName.has(newOptions.name)) {
        return false;
      }
      this.byName.delete(uid);

      uid = newOptions.name;
      this.byName.set(uid, current);
    }

    // Type changed -- requires full re-initalization
    if (current.options.type !== newOptions.type) {
      // full init
    } else {
      // just update options
    }

    const layers = this.layers.slice(0);
    try {
      const info = await this.initLayer(this.map, newOptions, current.isBasemap);
      layers[layerIndex]?.handler.dispose?.();
      layers[layerIndex] = info;
      group.setAt(layerIndex, info.layer);

      // initialize with new data
      this.applyLayerFilter(info.handler, newOptions);
    } catch (err) {
      console.warn('ERROR', err);
      return false;
    }

    // Just to trigger a state update
    this.setState({ legends: [] });

    this.layers = layers;
    this.doOptionsUpdate(layerIndex);
    return true;
  };

  async initLayer(map: PluggableMap, options: MapLayerOptions, isBasemap?: boolean): Promise<MapLayerState> {
    if (isBasemap && (!options?.type || config.geomapDisableCustomBaseLayer)) {
      options = DEFAULT_BASEMAP_CONFIG;
    }

    // Use default makers layer
    if (!options?.type) {
      options = {
        type: MARKERS_LAYER_ID,
        name: this.getNextLayerName(),
        config: {},
      };
    }

    const item = geomapLayerRegistry.getIfExists(options.type);
    if (!item) {
      return Promise.reject('unknown layer: ' + options.type);
    }

    const handler = await item.create(map, options, this.props.eventBus, config.theme2);
    const layer = handler.init();
    if (options.opacity != null) {
      layer.setOpacity(options.opacity);
    }

    if (!options.name) {
      options.name = this.getNextLayerName();
    }

    const UID = options.name;
    const state: MapLayerState<unknown> = {
      // UID, // unique name when added to the map (it may change and will need special handling)
      isBasemap,
      options,
      layer,
      handler,
      mouseEvents: new Subject<FeatureLike | undefined>(),

      getName: () => UID,

      // Used by the editors
      onChange: (cfg: MapLayerOptions) => {
        this.updateLayer(UID, cfg);
      },
    };

    this.byName.set(UID, state);
    (state.layer as any).__state = state;

    this.applyLayerFilter(handler, options);

    return state;
  }

  applyLayerFilter(handler: MapLayerHandler<unknown>, options: MapLayerOptions<unknown>): void {
    if (handler.update) {
      let panelData = this.props.data;
      if (options.filterData) {
        const matcherFunc = getFrameMatchers(options.filterData);
        panelData = {
          ...panelData,
          series: panelData.series.filter(matcherFunc),
        };
      }
      handler.update(panelData);
    }
  }

  initMapView(config: MapViewConfig, layers?: Collection<BaseLayer>): View {
    let view = new View({
      center: [0, 0],
      zoom: 1,
      showFullExtent: true, // allows zooming so the full range is visible
    });

    // With shared views, all panels use the same view instance
    if (config.shared) {
      if (!sharedView) {
        sharedView = view;
      } else {
        view = sharedView;
      }
    }
    if (layers) {
      this.initViewExtent(view, config, layers);
    }
    return view;
  }

  initViewExtent(view: View, config: MapViewConfig, layers: Collection<BaseLayer>) {
    const v = centerPointRegistry.getIfExists(config.id);
    if (v) {
      let coord: Coordinate | undefined = undefined;
      if (v.lat == null) {
        if (v.id === MapCenterID.Coordinates) {
          coord = [config.lon ?? 0, config.lat ?? 0];
        } else if (v.id === MapCenterID.Fit) {
          const extent = getLayersExtent(layers);
          if (!isEmpty(extent)) {
            view.fit(extent, {
              padding: [30, 30, 30, 30],
              maxZoom: config.zoom ?? config.maxZoom,
            });
          }
        } else {
          // TODO: view requires special handling
        }
      } else {
        coord = [v.lon ?? 0, v.lat ?? 0];
      }
      if (coord) {
        view.setCenter(fromLonLat(coord));
      }
    }

    if (config.maxZoom) {
      view.setMaxZoom(config.maxZoom);
    }
    if (config.minZoom) {
      view.setMaxZoom(config.minZoom);
    }
    if (config.zoom && v?.id !== MapCenterID.Fit) {
      view.setZoom(config.zoom);
    }
  }

  initControls(options: ControlsOptions) {
    if (!this.map) {
      return;
    }
    this.map.getControls().clear();

    if (options.showZoom) {
      this.map.addControl(new Zoom());
    }

    if (options.showScale) {
      this.map.addControl(
        new ScaleLine({
          units: options.scaleUnits,
          minWidth: 100,
        })
      );
    }

    this.mouseWheelZoom!.setActive(Boolean(options.mouseWheelZoom));

    if (options.showAttribution) {
      this.map.addControl(new Attribution({ collapsed: true, collapsible: true }));
    }

    // Update the react overlays
    let topRight1: ReactNode[] = [];
    if (options.showMeasure) {
      topRight1 = [
        <MeasureOverlay
          key="measure"
          map={this.map}
          // Lifts menuActive state and resets tooltip state upon close
          menuActiveState={(value: boolean) => {
            this.setState({ ttipOpen: value, measureMenuActive: value });
          }}
        />,
      ];
    }

    let topRight2: ReactNode[] = [];
    if (options.showDebug) {
      topRight2 = [<DebugOverlay key="debug" map={this.map} />];
    }

    this.setState({ topRight1, topRight2 });
  }

  getLegends() {
    const legends: ReactNode[] = [];
    for (const state of this.layers) {
      if (state.handler.legend) {
        legends.push(<div key={state.options.name}>{state.handler.legend}</div>);
      }
    }

    return legends;
  }

  render() {
    let { ttip, ttipOpen, topRight1, legends, topRight2 } = this.state;
    const { options } = this.props;
    const showScale = options.controls.showScale;
    if (!ttipOpen && options.tooltip?.mode === TooltipMode.None) {
      ttip = undefined;
    }

    return (
      <>
        <Global styles={this.globalCSS} />
        <div className={this.style.wrap} onMouseLeave={this.clearTooltip}>
          <div className={this.style.map} ref={this.initMapRef}></div>
          <GeomapOverlay
            bottomLeft={legends}
            topRight1={topRight1}
            topRight2={topRight2}
            blStyle={{ bottom: showScale ? '35px' : '8px' }}
          />
        </div>
        <GeomapTooltip ttip={ttip} isOpen={ttipOpen} onClose={this.tooltipPopupClosed} />
      </>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrap: css`
    position: relative;
    width: 100%;
    height: 100%;
  `,
  map: css`
    position: absolute;
    z-index: 0;
    width: 100%;
    height: 100%;
  `,
}));
