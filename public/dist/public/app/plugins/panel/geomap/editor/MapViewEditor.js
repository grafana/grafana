import { __assign } from "tslib";
import React, { useMemo, useCallback } from 'react';
import { Button, InlineField, InlineFieldRow, Select, VerticalGroup } from '@grafana/ui';
import { centerPointRegistry, MapCenterID } from '../view';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';
import { toLonLat } from 'ol/proj';
export var MapViewEditor = function (_a) {
    var _b;
    var value = _a.value, onChange = _a.onChange, context = _a.context;
    var labelWidth = 10;
    var views = useMemo(function () {
        var ids = [];
        if (value === null || value === void 0 ? void 0 : value.id) {
            ids.push(value.id);
        }
        else {
            ids.push(centerPointRegistry.list()[0].id);
        }
        return centerPointRegistry.selectOptions(ids);
    }, [value === null || value === void 0 ? void 0 : value.id]);
    var onSetCurrentView = useCallback(function () {
        var _a;
        var map = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.map;
        if (map) {
            var view = map.getView();
            var coords = view.getCenter();
            if (coords) {
                var center = toLonLat(coords, view.getProjection());
                onChange(__assign(__assign({}, value), { id: MapCenterID.Coordinates, lon: +center[0].toFixed(6), lat: +center[1].toFixed(6), zoom: +view.getZoom().toFixed(2) }));
            }
        }
    }, [value, onChange, context.instanceState]);
    var onSelectView = useCallback(function (selection) {
        var _a, _b, _c;
        var v = centerPointRegistry.getIfExists(selection.value);
        if (v) {
            onChange(__assign(__assign({}, value), { id: v.id, lat: (_a = v.lat) !== null && _a !== void 0 ? _a : value === null || value === void 0 ? void 0 : value.lat, lon: (_b = v.lon) !== null && _b !== void 0 ? _b : value === null || value === void 0 ? void 0 : value.lon, zoom: (_c = v.zoom) !== null && _c !== void 0 ? _c : value === null || value === void 0 ? void 0 : value.zoom }));
        }
    }, [value, onChange]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "View", labelWidth: labelWidth, grow: true },
                React.createElement(Select, { menuShouldPortal: true, options: views.options, value: views.current, onChange: onSelectView }))),
        (value === null || value === void 0 ? void 0 : value.id) === MapCenterID.Coordinates && (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Latitude", labelWidth: labelWidth, grow: true },
                    React.createElement(NumberInput, { value: value.lat, min: -90, max: 90, step: 0.001, onChange: function (v) {
                            onChange(__assign(__assign({}, value), { lat: v }));
                        } }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Longitude", labelWidth: labelWidth, grow: true },
                    React.createElement(NumberInput, { value: value.lon, min: -180, max: 180, step: 0.001, onChange: function (v) {
                            onChange(__assign(__assign({}, value), { lon: v }));
                        } }))))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Zoom", labelWidth: labelWidth, grow: true },
                React.createElement(NumberInput, { value: (_b = value === null || value === void 0 ? void 0 : value.zoom) !== null && _b !== void 0 ? _b : 1, min: 1, max: 18, step: 0.01, onChange: function (v) {
                        onChange(__assign(__assign({}, value), { zoom: v }));
                    } }))),
        React.createElement(VerticalGroup, null,
            React.createElement(Button, { variant: "secondary", size: "sm", fullWidth: true, onClick: onSetCurrentView },
                React.createElement("span", null, "Use current map settings")))));
};
//# sourceMappingURL=MapViewEditor.js.map