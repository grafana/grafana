import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import { View } from 'ol';
import Attribution from 'ol/control/Attribution';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import { isEmpty } from 'ol/extent';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import { fromLonLat } from 'ol/proj';
import React, { Component } from 'react';
import { Subscription } from 'rxjs';
import { DataHoverEvent } from '@grafana/data';
import { config } from '@grafana/runtime';
import { PanelContextRoot } from '@grafana/ui';
import { PanelEditExitedEvent } from 'app/types/events';
import { GeomapOverlay } from './GeomapOverlay';
import { GeomapTooltip } from './GeomapTooltip';
import { DebugOverlay } from './components/DebugOverlay';
import { MeasureOverlay } from './components/MeasureOverlay';
import { MeasureVectorLayer } from './components/MeasureVectorLayer';
import { getGlobalStyles } from './globalStyles';
import { defaultMarkersConfig } from './layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG } from './layers/registry';
import { TooltipMode } from './types';
import { getActions } from './utils/actions';
import { getLayersExtent } from './utils/getLayersExtent';
import { applyLayerFilter, initLayer } from './utils/layers';
import { pointerClickListener, pointerMoveListener, setTooltipListeners } from './utils/tooltip';
import { updateMap, getNewOpenLayersMap, notifyPanelEditor } from './utils/utils';
import { centerPointRegistry, MapCenterID } from './view';
// Allows multiple panels to share the same view instance
let sharedView = undefined;
export class GeomapPanel extends Component {
    constructor(props) {
        super(props);
        this.panelContext = undefined;
        this.subs = new Subscription();
        this.globalCSS = getGlobalStyles(config.theme2);
        this.hoverPayload = { point: {}, pageX: -1, pageY: -1 };
        this.hoverEvent = new DataHoverEvent(this.hoverPayload);
        this.layers = [];
        this.byName = new Map();
        this.actions = getActions(this);
        this.initMapRef = (div) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
            const layers = [];
            try {
                layers.push(yield initLayer(this, map, (_a = options.basemap) !== null && _a !== void 0 ? _a : DEFAULT_BASEMAP_CONFIG, true));
                // Default layer values
                if (!options.layers) {
                    options.layers = [defaultMarkersConfig];
                }
                for (const lyr of options.layers) {
                    layers.push(yield initLayer(this, map, lyr, false));
                }
            }
            catch (ex) {
                console.error('error loading layers', ex);
            }
            for (const lyr of layers) {
                map.addLayer(lyr.layer);
            }
            this.layers = layers;
            this.map = map; // redundant
            this.initViewExtent(map.getView(), options.view);
            this.mouseWheelZoom = new MouseWheelZoom();
            (_b = this.map) === null || _b === void 0 ? void 0 : _b.addInteraction(this.mouseWheelZoom);
            updateMap(this, options);
            setTooltipListeners(this);
            notifyPanelEditor(this, layers, layers.length - 1);
            this.setState({ legends: this.getLegends() });
        });
        this.clearTooltip = () => {
            if (this.state.ttip && !this.state.ttipOpen) {
                this.tooltipPopupClosed();
            }
        };
        this.tooltipPopupClosed = () => {
            this.setState({ ttipOpen: false, ttip: undefined });
        };
        this.pointerClickListener = (evt) => {
            pointerClickListener(evt, this);
        };
        this.pointerMoveListener = (evt) => {
            pointerMoveListener(evt, this);
        };
        this.initMapView = (config, sharedView) => {
            let view = new View({
                center: [0, 0],
                zoom: 1,
                showFullExtent: true, // allows zooming so the full range is visible
            });
            // With shared views, all panels use the same view instance
            if (config.shared) {
                if (!sharedView) {
                    sharedView = view;
                }
                else {
                    view = sharedView;
                }
            }
            this.initViewExtent(view, config);
            return [sharedView, view];
        };
        this.state = { ttipOpen: false, legends: [] };
        this.subs.add(this.props.eventBus.subscribe(PanelEditExitedEvent, (evt) => {
            if (this.mapDiv && this.props.id === evt.payload) {
                this.initMapRef(this.mapDiv);
            }
        }));
    }
    componentDidMount() {
        this.panelContext = this.context;
    }
    componentWillUnmount() {
        var _a, _b, _c;
        this.subs.unsubscribe();
        for (const lyr of this.layers) {
            (_b = (_a = lyr.handler).dispose) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        // Ensure map is disposed
        (_c = this.map) === null || _c === void 0 ? void 0 : _c.dispose();
    }
    shouldComponentUpdate(nextProps) {
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
    componentDidUpdate(prevProps) {
        if (this.map && (this.props.height !== prevProps.height || this.props.width !== prevProps.width)) {
            this.map.updateSize();
        }
        // Check for a difference between previous data and component data
        if (this.map && this.props.data !== prevProps.data) {
            this.dataChanged(this.props.data);
        }
    }
    /** This function will actually update the JSON model */
    doOptionsUpdate(selected) {
        var _a;
        const { options, onOptionsChange } = this.props;
        const layers = this.layers;
        (_a = this.map) === null || _a === void 0 ? void 0 : _a.getLayers().forEach((l) => {
            var _a, _b;
            if (l instanceof MeasureVectorLayer) {
                (_a = this.map) === null || _a === void 0 ? void 0 : _a.removeLayer(l);
                (_b = this.map) === null || _b === void 0 ? void 0 : _b.addLayer(l);
            }
        });
        onOptionsChange(Object.assign(Object.assign({}, options), { basemap: layers[0].options, layers: layers.slice(1).map((v) => v.options) }));
        notifyPanelEditor(this, layers, selected);
        this.setState({ legends: this.getLegends() });
    }
    /**
     * Called when the panel options change
     *
     * NOTE: changes to basemap and layers are handled independently
     */
    optionsChanged(options) {
        var _a;
        const oldOptions = this.props.options;
        if (options.view !== oldOptions.view) {
            const [updatedSharedView, view] = this.initMapView(options.view, sharedView);
            sharedView = updatedSharedView;
            if (this.map && view) {
                this.map.setView(view);
            }
        }
        if (options.controls !== oldOptions.controls) {
            this.initControls((_a = options.controls) !== null && _a !== void 0 ? _a : { showZoom: true, showAttribution: true });
        }
    }
    /**
     * Called when PanelData changes (query results etc)
     */
    dataChanged(data) {
        // Only update if panel data matches component data
        if (data === this.props.data) {
            for (const state of this.layers) {
                applyLayerFilter(state.handler, state.options, this.props.data);
            }
        }
        // Because data changed, check map view and change if needed (data fit)
        const v = centerPointRegistry.getIfExists(this.props.options.view.id);
        if (v && v.id === MapCenterID.Fit) {
            const [, view] = this.initMapView(this.props.options.view);
            if (this.map && view) {
                this.map.setView(view);
            }
        }
    }
    initViewExtent(view, config) {
        var _a, _b, _c, _d, _e, _f, _g;
        const v = centerPointRegistry.getIfExists(config.id);
        if (v) {
            let coord = undefined;
            if (v.lat == null) {
                if (v.id === MapCenterID.Coordinates) {
                    coord = [(_a = config.lon) !== null && _a !== void 0 ? _a : 0, (_b = config.lat) !== null && _b !== void 0 ? _b : 0];
                }
                else if (v.id === MapCenterID.Fit) {
                    const extent = getLayersExtent(this.layers, config.allLayers, config.lastOnly, config.layer);
                    if (!isEmpty(extent)) {
                        const padding = (_c = config.padding) !== null && _c !== void 0 ? _c : 5;
                        const res = view.getResolutionForExtent(extent, (_d = this.map) === null || _d === void 0 ? void 0 : _d.getSize());
                        const maxZoom = (_e = config.zoom) !== null && _e !== void 0 ? _e : config.maxZoom;
                        view.fit(extent, {
                            maxZoom: maxZoom,
                        });
                        view.setResolution(res * (padding / 100 + 1));
                        const adjustedZoom = view.getZoom();
                        if (adjustedZoom && maxZoom && adjustedZoom > maxZoom) {
                            view.setZoom(maxZoom);
                        }
                    }
                }
                else {
                    // TODO: view requires special handling
                }
            }
            else {
                coord = [(_f = v.lon) !== null && _f !== void 0 ? _f : 0, (_g = v.lat) !== null && _g !== void 0 ? _g : 0];
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
        if (config.zoom && (v === null || v === void 0 ? void 0 : v.id) !== MapCenterID.Fit) {
            view.setZoom(config.zoom);
        }
    }
    initControls(options) {
        if (!this.map) {
            return;
        }
        this.map.getControls().clear();
        if (options.showZoom) {
            this.map.addControl(new Zoom());
        }
        if (options.showScale) {
            this.map.addControl(new ScaleLine({
                units: options.scaleUnits,
                minWidth: 100,
            }));
        }
        this.mouseWheelZoom.setActive(Boolean(options.mouseWheelZoom));
        if (options.showAttribution) {
            this.map.addControl(new Attribution({ collapsed: true, collapsible: true }));
        }
        // Update the react overlays
        let topRight1 = [];
        if (options.showMeasure) {
            topRight1 = [
                React.createElement(MeasureOverlay, { key: "measure", map: this.map, 
                    // Lifts menuActive state and resets tooltip state upon close
                    menuActiveState: (value) => {
                        this.setState({ ttipOpen: value, measureMenuActive: value });
                    } }),
            ];
        }
        let topRight2 = [];
        if (options.showDebug) {
            topRight2 = [React.createElement(DebugOverlay, { key: "debug", map: this.map })];
        }
        this.setState({ topRight1, topRight2 });
    }
    getLegends() {
        const legends = [];
        for (const state of this.layers) {
            if (state.handler.legend) {
                legends.push(React.createElement("div", { key: state.options.name }, state.handler.legend));
            }
        }
        return legends;
    }
    render() {
        var _a;
        let { ttip, ttipOpen, topRight1, legends, topRight2 } = this.state;
        const { options } = this.props;
        const showScale = options.controls.showScale;
        if (!ttipOpen && ((_a = options.tooltip) === null || _a === void 0 ? void 0 : _a.mode) === TooltipMode.None) {
            ttip = undefined;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(Global, { styles: this.globalCSS }),
            React.createElement("div", { className: styles.wrap, onMouseLeave: this.clearTooltip },
                React.createElement("div", { className: styles.map, ref: this.initMapRef }),
                React.createElement(GeomapOverlay, { bottomLeft: legends, topRight1: topRight1, topRight2: topRight2, blStyle: { bottom: showScale ? '35px' : '8px' } })),
            React.createElement(GeomapTooltip, { ttip: ttip, isOpen: ttipOpen, onClose: this.tooltipPopupClosed })));
    }
}
GeomapPanel.contextType = PanelContextRoot;
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
//# sourceMappingURL=GeomapPanel.js.map