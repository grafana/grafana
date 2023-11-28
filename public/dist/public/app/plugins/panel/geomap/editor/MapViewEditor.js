import { toLonLat } from 'ol/proj';
import React, { useMemo, useCallback } from 'react';
import { Button, InlineField, InlineFieldRow, Select, VerticalGroup } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { centerPointRegistry, MapCenterID } from '../view';
import { CoordinatesMapViewEditor } from './CoordinatesMapViewEditor';
import { FitMapViewEditor } from './FitMapViewEditor';
export const MapViewEditor = ({ value, onChange, context, }) => {
    var _a;
    const labelWidth = 10;
    const views = useMemo(() => {
        const ids = [];
        if (value === null || value === void 0 ? void 0 : value.id) {
            ids.push(value.id);
        }
        else {
            ids.push(centerPointRegistry.list()[0].id);
        }
        return centerPointRegistry.selectOptions(ids);
    }, [value === null || value === void 0 ? void 0 : value.id]);
    const onSetCurrentView = useCallback(() => {
        var _a;
        const map = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.map;
        if (map) {
            const view = map.getView();
            const coords = view.getCenter();
            if (coords) {
                const center = toLonLat(coords, view.getProjection());
                onChange(Object.assign(Object.assign({}, value), { id: MapCenterID.Coordinates, lon: +center[0].toFixed(6), lat: +center[1].toFixed(6), zoom: +view.getZoom().toFixed(2) }));
            }
        }
    }, [value, onChange, context.instanceState]);
    const onSelectView = useCallback((selection) => {
        var _a, _b, _c;
        const v = centerPointRegistry.getIfExists(selection.value);
        if (v) {
            onChange(Object.assign(Object.assign({}, value), { id: v.id, lat: (_a = v.lat) !== null && _a !== void 0 ? _a : value === null || value === void 0 ? void 0 : value.lat, lon: (_b = v.lon) !== null && _b !== void 0 ? _b : value === null || value === void 0 ? void 0 : value.lon, zoom: (_c = v.zoom) !== null && _c !== void 0 ? _c : value === null || value === void 0 ? void 0 : value.zoom }));
        }
    }, [value, onChange]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "View", labelWidth: labelWidth, grow: true },
                React.createElement(Select, { options: views.options, value: views.current, onChange: onSelectView }))),
        value.id === MapCenterID.Coordinates && (React.createElement(CoordinatesMapViewEditor, { labelWidth: labelWidth, value: value, onChange: onChange })),
        value.id === MapCenterID.Fit && (React.createElement(FitMapViewEditor, { labelWidth: labelWidth, value: value, onChange: onChange, context: context })),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: (value === null || value === void 0 ? void 0 : value.id) === MapCenterID.Fit ? 'Max Zoom' : 'Zoom', labelWidth: labelWidth, grow: true },
                React.createElement(NumberInput, { value: (_a = value === null || value === void 0 ? void 0 : value.zoom) !== null && _a !== void 0 ? _a : 1, min: 1, max: 18, step: 0.01, onChange: (v) => {
                        onChange(Object.assign(Object.assign({}, value), { zoom: v }));
                    } }))),
        React.createElement(VerticalGroup, null,
            React.createElement(Button, { variant: "secondary", size: "sm", fullWidth: true, onClick: onSetCurrentView },
                React.createElement("span", null, "Use current map settings")))));
};
//# sourceMappingURL=MapViewEditor.js.map