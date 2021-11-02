import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __read, __values } from "tslib";
import React, { Component } from 'react';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from './layers/registry';
import { Map, View } from 'ol';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import { defaults as interactionDefaults } from 'ol/interaction';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import { DataHoverClearEvent, DataHoverEvent, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { centerPointRegistry, MapCenterID } from './view';
import { fromLonLat, toLonLat } from 'ol/proj';
import { css } from '@emotion/css';
import { PanelContextRoot, Portal, stylesFactory, VizTooltipContainer } from '@grafana/ui';
import { GeomapOverlay } from './GeomapOverlay';
import { DebugOverlay } from './components/DebugOverlay';
import { getGlobalStyles } from './globalStyles';
import { Global } from '@emotion/react';
import { DataHoverView } from './components/DataHoverView';
import { Subscription } from 'rxjs';
import { PanelEditExitedEvent } from 'app/types/events';
import { defaultMarkersConfig, MARKERS_LAYER_ID } from './layers/data/markersLayer';
import { cloneDeep } from 'lodash';
// Allows multiple panels to share the same view instance
var sharedView = undefined;
var GeomapPanel = /** @class */ (function (_super) {
    __extends(GeomapPanel, _super);
    function GeomapPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.panelContext = {};
        _this.subs = new Subscription();
        _this.globalCSS = getGlobalStyles(config.theme2);
        _this.counter = 0;
        _this.style = getStyles(config.theme);
        _this.hoverPayload = { point: {}, pageX: -1, pageY: -1 };
        _this.hoverEvent = new DataHoverEvent(_this.hoverPayload);
        _this.layers = [];
        _this.actions = {
            selectLayer: function (uid) {
                var selected = _this.layers.findIndex(function (v) { return v.UID === uid; });
                if (_this.panelContext.onInstanceStateChange) {
                    _this.panelContext.onInstanceStateChange({
                        map: _this.map,
                        layers: _this.layers,
                        selected: selected,
                        actions: _this.actions,
                    });
                }
            },
            deleteLayer: function (uid) {
                var e_1, _a;
                var _b;
                var layers = [];
                try {
                    for (var _c = __values(_this.layers), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var lyr = _d.value;
                        if (lyr.UID === uid) {
                            (_b = _this.map) === null || _b === void 0 ? void 0 : _b.removeLayer(lyr.layer);
                        }
                        else {
                            layers.push(lyr);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                _this.layers = layers;
                _this.doOptionsUpdate(0);
            },
            addlayer: function (type) {
                var item = geomapLayerRegistry.getIfExists(type);
                if (!item) {
                    return; // ignore empty request
                }
                _this.initLayer(_this.map, {
                    type: item.id,
                    config: cloneDeep(item.defaultOptions),
                }, false).then(function (lyr) {
                    var _a;
                    _this.layers = _this.layers.slice(0);
                    _this.layers.push(lyr);
                    (_a = _this.map) === null || _a === void 0 ? void 0 : _a.addLayer(lyr.layer);
                    _this.doOptionsUpdate(_this.layers.length - 1);
                });
            },
            reorder: function (startIndex, endIndex) {
                var result = Array.from(_this.layers);
                var _a = __read(result.splice(startIndex, 1), 1), removed = _a[0];
                result.splice(endIndex, 0, removed);
                _this.layers = result;
                _this.doOptionsUpdate(endIndex);
            },
        };
        _this.initMapRef = function (div) { return __awaiter(_this, void 0, void 0, function () {
            var options, map, layers, _a, _b, layerOptions, layerOptions_1, layerOptions_1_1, lyr, _c, _d, e_2_1, ex_1, layers_1, layers_1_1, lyr;
            var e_2, _e, e_3, _f;
            var _this = this;
            var _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        this.mapDiv = div;
                        if (this.map) {
                            this.map.dispose();
                        }
                        if (!div) {
                            this.map = undefined;
                            return [2 /*return*/];
                        }
                        options = this.props.options;
                        map = (this.map = new Map({
                            view: this.initMapView(options.view),
                            pixelRatio: 1,
                            layers: [],
                            controls: [],
                            target: div,
                            interactions: interactionDefaults({
                                mouseWheelZoom: false, // managed by initControls
                            }),
                        }));
                        layers = [];
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 11, , 12]);
                        _b = (_a = layers).push;
                        return [4 /*yield*/, this.initLayer(map, (_g = options.basemap) !== null && _g !== void 0 ? _g : DEFAULT_BASEMAP_CONFIG, true)];
                    case 2:
                        _b.apply(_a, [_h.sent()]);
                        layerOptions = options.layers;
                        if (!layerOptions) {
                            layerOptions = [defaultMarkersConfig];
                        }
                        _h.label = 3;
                    case 3:
                        _h.trys.push([3, 8, 9, 10]);
                        layerOptions_1 = __values(layerOptions), layerOptions_1_1 = layerOptions_1.next();
                        _h.label = 4;
                    case 4:
                        if (!!layerOptions_1_1.done) return [3 /*break*/, 7];
                        lyr = layerOptions_1_1.value;
                        _d = (_c = layers).push;
                        return [4 /*yield*/, this.initLayer(map, lyr, false)];
                    case 5:
                        _d.apply(_c, [_h.sent()]);
                        _h.label = 6;
                    case 6:
                        layerOptions_1_1 = layerOptions_1.next();
                        return [3 /*break*/, 4];
                    case 7: return [3 /*break*/, 10];
                    case 8:
                        e_2_1 = _h.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 10];
                    case 9:
                        try {
                            if (layerOptions_1_1 && !layerOptions_1_1.done && (_e = layerOptions_1.return)) _e.call(layerOptions_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                        return [7 /*endfinally*/];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        ex_1 = _h.sent();
                        console.error('error loading layers', ex_1);
                        return [3 /*break*/, 12];
                    case 12:
                        this.layers = layers;
                        try {
                            for (layers_1 = __values(layers), layers_1_1 = layers_1.next(); !layers_1_1.done; layers_1_1 = layers_1.next()) {
                                lyr = layers_1_1.value;
                                this.map.addLayer(lyr.layer);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (layers_1_1 && !layers_1_1.done && (_f = layers_1.return)) _f.call(layers_1);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                        this.mouseWheelZoom = new MouseWheelZoom();
                        this.map.addInteraction(this.mouseWheelZoom);
                        this.initControls(options.controls);
                        this.forceUpdate(); // first render
                        // Tooltip listener
                        this.map.on('pointermove', this.pointerMoveListener);
                        this.map.getViewport().addEventListener('mouseout', function (evt) {
                            _this.props.eventBus.publish(new DataHoverClearEvent());
                        });
                        // Notify the the panel editor
                        if (this.panelContext.onInstanceStateChange) {
                            this.panelContext.onInstanceStateChange({
                                map: this.map,
                                layers: layers,
                                selected: layers.length - 1,
                                actions: this.actions,
                            });
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        _this.clearTooltip = function () {
            if (_this.state.ttip) {
                _this.setState({ ttip: undefined });
            }
        };
        _this.pointerMoveListener = function (evt) {
            if (!_this.map) {
                return;
            }
            var mouse = evt.originalEvent;
            var pixel = _this.map.getEventPixel(mouse);
            var hover = toLonLat(_this.map.getCoordinateFromPixel(pixel));
            var hoverPayload = _this.hoverPayload;
            hoverPayload.pageX = mouse.pageX;
            hoverPayload.pageY = mouse.pageY;
            hoverPayload.point = {
                lat: hover[1],
                lon: hover[0],
            };
            hoverPayload.data = undefined;
            hoverPayload.columnIndex = undefined;
            hoverPayload.rowIndex = undefined;
            hoverPayload.feature = undefined;
            var ttip = {};
            var features = [];
            _this.map.forEachFeatureAtPixel(pixel, function (feature, layer, geo) {
                if (!hoverPayload.data) {
                    var props = feature.getProperties();
                    var frame = props['frame'];
                    if (frame) {
                        hoverPayload.data = ttip.data = frame;
                        hoverPayload.rowIndex = ttip.rowIndex = props['rowIndex'];
                    }
                    else {
                        hoverPayload.feature = ttip.feature = feature;
                    }
                }
                features.push({ feature: feature, layer: layer, geo: geo });
            });
            _this.hoverPayload.features = features.length ? features : undefined;
            _this.props.eventBus.publish(_this.hoverEvent);
            var currentTTip = _this.state.ttip;
            if (ttip.data !== (currentTTip === null || currentTTip === void 0 ? void 0 : currentTTip.data) ||
                ttip.rowIndex !== (currentTTip === null || currentTTip === void 0 ? void 0 : currentTTip.rowIndex) ||
                ttip.feature !== (currentTTip === null || currentTTip === void 0 ? void 0 : currentTTip.feature)) {
                _this.setState({ ttip: __assign({}, hoverPayload) });
            }
        };
        _this.updateLayer = function (uid, newOptions) { return __awaiter(_this, void 0, void 0, function () {
            var selected, layers, found, current, info, group, i, err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.map) {
                            return [2 /*return*/, false];
                        }
                        selected = this.layers.findIndex(function (v) { return v.UID === uid; });
                        if (selected < 0) {
                            return [2 /*return*/, false];
                        }
                        layers = this.layers.slice(0);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        found = false;
                        current = this.layers[selected];
                        return [4 /*yield*/, this.initLayer(this.map, newOptions, current.isBasemap)];
                    case 2:
                        info = _b.sent();
                        group = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getLayers();
                        for (i = 0; i < (group === null || group === void 0 ? void 0 : group.getLength()); i++) {
                            if (group.item(i) === current.layer) {
                                found = true;
                                group.setAt(i, info.layer);
                                break;
                            }
                        }
                        if (!found) {
                            console.warn('ERROR not found', uid);
                            return [2 /*return*/, false];
                        }
                        layers[selected] = info;
                        // initalize with new data
                        if (info.handler.update) {
                            info.handler.update(this.props.data);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _b.sent();
                        console.warn('ERROR', err_1);
                        return [2 /*return*/, false];
                    case 4:
                        // TODO
                        // validate names, basemap etc
                        this.layers = layers;
                        this.doOptionsUpdate(selected);
                        return [2 /*return*/, true];
                }
            });
        }); };
        _this.state = {};
        _this.subs.add(_this.props.eventBus.subscribe(PanelEditExitedEvent, function (evt) {
            if (_this.mapDiv && _this.props.id === evt.payload) {
                _this.initMapRef(_this.mapDiv);
            }
        }));
        return _this;
    }
    GeomapPanel.prototype.componentDidMount = function () {
        this.panelContext = this.context;
    };
    GeomapPanel.prototype.shouldComponentUpdate = function (nextProps) {
        if (!this.map) {
            return true; // not yet initalized
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
    };
    GeomapPanel.prototype.doOptionsUpdate = function (selected) {
        var _a = this.props, options = _a.options, onOptionsChange = _a.onOptionsChange;
        var layers = this.layers;
        onOptionsChange(__assign(__assign({}, options), { basemap: layers[0].options, layers: layers.slice(1).map(function (v) { return v.options; }) }));
        // Notify the the panel editor
        if (this.panelContext.onInstanceStateChange) {
            this.panelContext.onInstanceStateChange({
                map: this.map,
                layers: layers,
                selected: selected,
                actions: this.actions,
            });
        }
    };
    /**
     * Called when the panel options change
     *
     * NOTE: changes to basemap and layers are handled independently
     */
    GeomapPanel.prototype.optionsChanged = function (options) {
        var _a;
        var oldOptions = this.props.options;
        console.log('options changed!', options);
        if (options.view !== oldOptions.view) {
            console.log('View changed');
            this.map.setView(this.initMapView(options.view));
        }
        if (options.controls !== oldOptions.controls) {
            console.log('Controls changed');
            this.initControls((_a = options.controls) !== null && _a !== void 0 ? _a : { showZoom: true, showAttribution: true });
        }
    };
    /**
     * Called when PanelData changes (query results etc)
     */
    GeomapPanel.prototype.dataChanged = function (data) {
        var e_4, _a;
        try {
            for (var _b = __values(this.layers), _c = _b.next(); !_c.done; _c = _b.next()) {
                var state = _c.value;
                if (state.handler.update) {
                    state.handler.update(data);
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
    };
    GeomapPanel.prototype.initLayer = function (map, options, isBasemap) {
        return __awaiter(this, void 0, void 0, function () {
            var item, handler, layer, UID;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (isBasemap && (!(options === null || options === void 0 ? void 0 : options.type) || config.geomapDisableCustomBaseLayer)) {
                            options = DEFAULT_BASEMAP_CONFIG;
                        }
                        // Use default makers layer
                        if (!(options === null || options === void 0 ? void 0 : options.type)) {
                            options = {
                                type: MARKERS_LAYER_ID,
                                config: {},
                            };
                        }
                        item = geomapLayerRegistry.getIfExists(options.type);
                        if (!item) {
                            return [2 /*return*/, Promise.reject('unknown layer: ' + options.type)];
                        }
                        return [4 /*yield*/, item.create(map, options, config.theme2)];
                    case 1:
                        handler = _a.sent();
                        layer = handler.init();
                        // const key = layer.on('change', () => {
                        //   const state = layer.getLayerState();
                        //   console.log('LAYER', key, state);
                        // });
                        if (handler.update) {
                            handler.update(this.props.data);
                        }
                        UID = "lyr-" + this.counter++;
                        return [2 /*return*/, {
                                UID: UID,
                                isBasemap: isBasemap,
                                options: options,
                                layer: layer,
                                handler: handler,
                                // Used by the editors
                                onChange: function (cfg) {
                                    _this.updateLayer(UID, cfg);
                                },
                            }];
                }
            });
        });
    };
    GeomapPanel.prototype.initMapView = function (config) {
        var _a, _b, _c, _d;
        var view = new View({
            center: [0, 0],
            zoom: 1,
            showFullExtent: true, // alows zooming so the full range is visiable
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
        var v = centerPointRegistry.getIfExists(config.id);
        if (v) {
            var coord = undefined;
            if (v.lat == null) {
                if (v.id === MapCenterID.Coordinates) {
                    coord = [(_a = config.lon) !== null && _a !== void 0 ? _a : 0, (_b = config.lat) !== null && _b !== void 0 ? _b : 0];
                }
                else {
                    console.log('TODO, view requires special handling', v);
                }
            }
            else {
                coord = [(_c = v.lon) !== null && _c !== void 0 ? _c : 0, (_d = v.lat) !== null && _d !== void 0 ? _d : 0];
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
        if (config.zoom) {
            view.setZoom(config.zoom);
        }
        return view;
    };
    GeomapPanel.prototype.initControls = function (options) {
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
        var topRight = [];
        if (options.showDebug) {
            topRight = [React.createElement(DebugOverlay, { key: "debug", map: this.map })];
        }
        this.setState({ topRight: topRight });
    };
    GeomapPanel.prototype.render = function () {
        var _a = this.state, ttip = _a.ttip, topRight = _a.topRight, bottomLeft = _a.bottomLeft;
        return (React.createElement(React.Fragment, null,
            React.createElement(Global, { styles: this.globalCSS }),
            React.createElement("div", { className: this.style.wrap, onMouseLeave: this.clearTooltip },
                React.createElement("div", { className: this.style.map, ref: this.initMapRef }),
                React.createElement(GeomapOverlay, { bottomLeft: bottomLeft, topRight: topRight })),
            React.createElement(Portal, null, ttip && (ttip.data || ttip.feature) && (React.createElement(VizTooltipContainer, { position: { x: ttip.pageX, y: ttip.pageY }, offset: { x: 10, y: 10 } },
                React.createElement(DataHoverView, __assign({}, ttip)))))));
    };
    GeomapPanel.contextType = PanelContextRoot;
    return GeomapPanel;
}(Component));
export { GeomapPanel };
var getStyles = stylesFactory(function (theme) { return ({
    wrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: relative;\n    width: 100%;\n    height: 100%;\n  "], ["\n    position: relative;\n    width: 100%;\n    height: 100%;\n  "]))),
    map: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    position: absolute;\n    z-index: 0;\n    width: 100%;\n    height: 100%;\n  "], ["\n    position: absolute;\n    z-index: 0;\n    width: 100%;\n    height: 100%;\n  "]))),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=GeomapPanel.js.map