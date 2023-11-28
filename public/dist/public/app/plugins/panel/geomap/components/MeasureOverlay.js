import { css } from '@emotion/css';
import React, { useMemo, useRef, useState } from 'react';
import { Button, IconButton, RadioButtonGroup, Select } from '@grafana/ui';
import { config } from 'app/core/config';
import { measures } from '../utils/measure';
import { MeasureVectorLayer } from './MeasureVectorLayer';
export const MeasureOverlay = ({ map, menuActiveState }) => {
    const vector = useRef(new MeasureVectorLayer());
    const measureStyle = getStyles(config.theme2);
    // Menu State Management
    const [firstLoad, setFirstLoad] = useState(true);
    const [menuActive, setMenuActive] = useState(false);
    // Options State
    const [options, setOptions] = useState({
        action: measures[0].value,
        unit: measures[0].units[0].value,
    });
    const unit = useMemo(() => {
        var _a;
        const action = (_a = measures.find((m) => m.value === options.action)) !== null && _a !== void 0 ? _a : measures[0];
        const current = action.getUnit(options.unit);
        vector.current.setOptions(options);
        return {
            current,
            options: action.units,
        };
    }, [options]);
    const clearPrevious = true;
    const showSegments = false;
    function toggleMenu() {
        var _a;
        setMenuActive(!menuActive);
        // Lift menu state
        // TODO: consolidate into one state
        menuActiveState(!menuActive);
        if (menuActive) {
            map.removeInteraction(vector.current.draw);
            vector.current.setVisible(false);
        }
        else {
            if (firstLoad) {
                // Initialize on first load
                setFirstLoad(false);
                vector.current.setZIndex(1);
                map.addLayer(vector.current);
                map.addInteraction(vector.current.modify);
            }
            vector.current.setVisible(true);
            map.removeInteraction(vector.current.draw); // Remove last interaction
            const a = (_a = measures.find((v) => v.value === options.action)) !== null && _a !== void 0 ? _a : measures[0];
            vector.current.addInteraction(map, a.geometry, showSegments, clearPrevious);
        }
    }
    return (React.createElement("div", { className: `${measureStyle.infoWrap} ${!menuActive ? measureStyle.infoWrapClosed : null}` }, menuActive ? (React.createElement("div", null,
        React.createElement("div", { className: measureStyle.rowGroup },
            React.createElement(RadioButtonGroup, { value: options.action, options: measures, size: "md", fullWidth: false, onChange: (e) => {
                    var _a;
                    map.removeInteraction(vector.current.draw);
                    const m = (_a = measures.find((v) => v.value === e)) !== null && _a !== void 0 ? _a : measures[0];
                    const unit = m.getUnit(options.unit);
                    setOptions(Object.assign(Object.assign({}, options), { action: m.value, unit: unit.value }));
                    vector.current.addInteraction(map, m.geometry, showSegments, clearPrevious);
                } }),
            React.createElement(Button, { className: measureStyle.button, icon: "times", variant: "secondary", size: "sm", onClick: toggleMenu })),
        React.createElement(Select, { className: measureStyle.unitSelect, value: unit.current, options: unit.options, isSearchable: false, onChange: (v) => {
                var _a, _b;
                const a = (_a = measures.find((v) => v.value === options.action)) !== null && _a !== void 0 ? _a : measures[0];
                const unit = (_b = a.getUnit(v.value)) !== null && _b !== void 0 ? _b : a.units[0];
                setOptions(Object.assign(Object.assign({}, options), { unit: unit.value }));
            } }))) : (React.createElement(IconButton, { className: measureStyle.icon, name: "ruler-combined", tooltip: "show measure tools", tooltipPlacement: "left", onClick: toggleMenu }))));
};
const getStyles = (theme) => ({
    button: css({
        marginLeft: 'auto',
    }),
    icon: css({
        backgroundColor: theme.colors.secondary.main,
        display: 'inline-block',
        height: '19.25px',
        margin: '1px',
        width: '19.25px',
    }),
    infoWrap: css({
        color: `${theme.colors.text}`,
        backgroundColor: theme.colors.background.secondary,
        // eslint-disable-next-line @grafana/no-border-radius-literal
        borderRadius: '4px',
        padding: '2px',
    }),
    infoWrapClosed: css({
        height: '25.25px',
        width: '25.25px',
    }),
    rowGroup: css({
        display: 'flex',
        justifyContent: 'flex-end',
    }),
    unitSelect: css({
        minWidth: '200px',
    }),
});
//# sourceMappingURL=MeasureOverlay.js.map