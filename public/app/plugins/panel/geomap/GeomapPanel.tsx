import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import OpenLayersMap from 'ol/Map';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import View, { ViewOptions } from 'ol/View';
import Attribution from 'ol/control/Attribution';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import { Coordinate } from 'ol/coordinate';
import { isEmpty } from 'ol/extent';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import { fromLonLat, transformExtent } from 'ol/proj';
import { Component, ReactNode } from 'react';
import * as React from 'react';
import { Subscription } from 'rxjs';

import { DataHoverEvent, PanelData, PanelProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { PanelContext, PanelContextRoot } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { VariablesChanged } from 'app/features/variables/types';
import { PanelEditExitedEvent } from 'app/types/events';

import { GeomapOverlay, OverlayProps } from './GeomapOverlay';
import { GeomapTooltip } from './GeomapTooltip';
import { DebugOverlay } from './components/DebugOverlay';
import { MeasureOverlay } from './components/MeasureOverlay';
import { MeasureVectorLayer } from './components/MeasureVectorLayer';
import { GeomapHoverPayload } from './event';
import { getGlobalStyles } from './globalStyles';
import { defaultMarkersConfig } from './layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG } from './layers/registry';
import { ControlsOptions, Options, MapLayerState, MapViewConfig, TooltipMode } from './types';
import { getActions } from './utils/actions';
import { getLayersExtent } from './utils/getLayersExtent';
import { applyLayerFilter, initLayer } from './utils/layers';
import { pointerClickListener, pointerMoveListener, setTooltipListeners } from './utils/tooltip';
import {
  updateMap,
  getNewOpenLayersMap,
  notifyPanelEditor,
  hasVariableDependencies,
  hasLayerData,
} from './utils/utils';
import { centerPointRegistry, MapCenterID } from './view';

// Allows multiple panels to share the same view instance
let sharedView: View | undefined = undefined;

type Props = PanelProps<Options>;
interface State extends OverlayProps {
  ttip?: GeomapHoverPayload;
  ttipOpen: boolean;
  legends: ReactNode[];
  measureMenuActive?: boolean;
}

export class GeomapPanel extends Component<Props, State> {
  declare context: React.ContextType<typeof PanelContextRoot>;
  static contextType = PanelContextRoot;
  panelContext: PanelContext | undefined = undefined;
  private subs = new Subscription();

  globalCSS = getGlobalStyles(config.theme2);

  mouseWheelZoom?: MouseWheelZoom;
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
    // Subscribe to variable changes
    this.subs.add(
      appEvents.subscribe(VariablesChanged, () => {
        if (this.mapDiv) {
          // Check if any of the map's layers are dependent on variables
          const hasDependencies = this.layers.some((layer) => {
            const config = layer.options.config;
            if (!config || typeof config !== 'object') {
              return false;
            }
            return hasVariableDependencies(config);
          });

          if (hasDependencies) {
            this.initMapRef(this.mapDiv);
          }
        }
      })
    );
  }

  componentDidMount() {
    this.panelContext = this.context;
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
    for (const lyr of this.layers) {
      lyr.handler.dispose?.();
    }
    // Ensure map is disposed
    this.map?.dispose();
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
    // Handle options changes
    if (this.props.options !== prevProps.options) {
      this.optionsChanged(prevProps.options, this.props.options);
    }
  }

  /** This function will actually update the JSON model */
  doOptionsUpdate(selected: number) {
    const { options, onOptionsChange } = this.props;
    const layers = this.layers;
    this.map?.getLayers().forEach((l) => {
      if (l instanceof MeasureVectorLayer) {
        this.map?.removeLayer(l);
        this.map?.addLayer(l);
      }
    });
    onOptionsChange({
      ...options,
      basemap: layers[0].options,
      layers: layers.slice(1).map((v) => v.options),
    });

    notifyPanelEditor(this, layers, selected);
    this.setState({ legends: this.getLegends() });
  }

  actions = getActions(this);

  /**
   * Called when the panel options change
   *
   * NOTE: changes to basemap and layers are handled independently
   */
  optionsChanged(oldOptions: Options, newOptions: Options) {
    // First check if noRepeat changed - requires full map reinitialization
    const noRepeatChanged = oldOptions.view?.noRepeat !== newOptions.view?.noRepeat;

    if (noRepeatChanged) {
      if (this.mapDiv) {
        this.initMapRef(this.mapDiv);
      }
      // Skip other options processing
      return;
    }

    // Handle incremental view changes
    if (oldOptions.view !== newOptions.view) {
      const view = this.initMapView(newOptions.view);
      if (this.map && view) {
        this.map.setView(view);
      }
    }

    // Handle controls changes
    if (newOptions.controls !== oldOptions.controls) {
      this.initControls(newOptions.controls ?? { showZoom: true, showAttribution: true });
    }
  }

  /**
   * Called when PanelData changes (query results etc)
   */
  dataChanged(data: PanelData) {
    // Only update if panel data matches component data
    if (data === this.props.data) {
      for (const state of this.layers) {
        applyLayerFilter(state.handler, state.options, this.props.data);
      }
    }

    // Because data changed, check map view and change if needed (data fit)
    const v = centerPointRegistry.getIfExists(this.props.options.view.id);
    if (v && v.id === MapCenterID.Fit) {
      const view = this.initMapView(this.props.options.view);

      if (this.map && view) {
        this.map.setView(view);
      }
    }

    // Update legends when data changes
    this.setState({ legends: this.getLegends() });
  }

  initMapRef = async (div: HTMLDivElement) => {
    if (!div) {
      // Do not initialize new map or dispose old map
      return;
    }
    this.mapDiv = div;
    if (this.map) {
      this.map.dispose();
    }

    const { options } = this.props;

    const map = getNewOpenLayersMap(this, options, div);

    this.byName.clear();
    const layers: MapLayerState[] = [];
    try {
      // Pass noRepeat setting to basemap layer
      const basemapOptions = {
        ...(options.basemap ?? DEFAULT_BASEMAP_CONFIG),
        noRepeat: options.view?.noRepeat ?? false,
      };
      layers.push(await initLayer(this, map, basemapOptions, true));

      // Default layer values
      if (!options.layers) {
        options.layers = [defaultMarkersConfig];
      }

      for (const lyr of options.layers) {
        layers.push(await initLayer(this, map, lyr, false));
      }
    } catch (ex) {
      console.error('error loading layers', ex);
    }

    for (const lyr of layers) {
      map.addLayer(lyr.layer);
    }
    this.layers = layers;
    this.map = map; // redundant
    this.initViewExtent(map.getView(), options.view);

    this.mouseWheelZoom = new MouseWheelZoom();
    this.map?.addInteraction(this.mouseWheelZoom);

    updateMap(this, options);
    setTooltipListeners(this);
    notifyPanelEditor(this, layers, layers.length - 1);

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

  pointerClickListener = (evt: MapBrowserEvent<PointerEvent>) => {
    pointerClickListener(evt, this);
  };

  pointerMoveListener = (evt: MapBrowserEvent<PointerEvent>) => {
    pointerMoveListener(evt, this);
  };

  initMapView = (config: MapViewConfig): View | undefined => {
    const noRepeat = config.noRepeat ?? false;

    let viewOptions: ViewOptions = {
      center: [0, 0],
      zoom: 1,
    };

    // Only apply constraints when no-repeat is enabled
    if (noRepeat) {
      // Define the world extent in EPSG:3857 (Web Mercator)
      const worldExtent = [-180, -85.05112878, 180, 85.05112878]; // [minx, miny, maxx, maxy] in EPSG:4326
      const projectedExtent = transformExtent(worldExtent, 'EPSG:4326', 'EPSG:3857');
      viewOptions.extent = projectedExtent;
      viewOptions.showFullExtent = false;
      viewOptions.constrainOnlyCenter = false;
    }

    let view = new View(viewOptions);

    // With shared views, all panels use the same view instance
    if (config.shared) {
      if (!sharedView) {
        sharedView = view;
      } else {
        view = sharedView;
      }
    }

    this.initViewExtent(view, config);
    return view;
  };

  initViewExtent(view: View, config: MapViewConfig) {
    const v = centerPointRegistry.getIfExists(config.id);
    if (v) {
      let coord: Coordinate | undefined = undefined;
      if (v.lat == null) {
        if (v.id === MapCenterID.Coordinates) {
          coord = [config.lon ?? 0, config.lat ?? 0];
        } else if (v.id === MapCenterID.Fit) {
          const extent = getLayersExtent(this.layers, config.allLayers, config.lastOnly, config.layer);
          if (!isEmpty(extent)) {
            const padding = config.padding ?? 5;
            const res = view.getResolutionForExtent(extent, this.map?.getSize());
            const maxZoom = config.zoom ?? config.maxZoom;
            view.fit(extent, {
              maxZoom: maxZoom,
            });
            view.setResolution(res * (padding / 100 + 1));
            const adjustedZoom = view.getZoom();
            if (adjustedZoom && maxZoom && adjustedZoom > maxZoom) {
              view.setZoom(maxZoom);
            }
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
        const hasData = hasLayerData(state.layer);
        if (hasData) {
          legends.push(<div key={state.options.name}>{state.handler.legend}</div>);
        }
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
        <div className={styles.wrap} onMouseLeave={this.clearTooltip}>
          <div
            role="application"
            className={styles.map}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0} // Interactivity is added through the ref
            aria-label={t('geomap.geomap-panel.aria-label-map', 'Navigable map')}
            ref={this.initMapRef}
          ></div>
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

const styles = {
  wrap: css({
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  map: css({
    position: 'absolute',
    zIndex: 0,
    width: '100%',
    height: '100%',
  }),
};
