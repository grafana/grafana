import React, { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@grafana/ui';
export const OutsideRangePlugin = ({ config, onChangeTimeRange }) => {
    const plotInstance = useRef();
    const [timevalues, setTimeValues] = useState([]);
    const [timeRange, setTimeRange] = useState();
    useLayoutEffect(() => {
        config.addHook('init', (u) => {
            plotInstance.current = u;
        });
        config.addHook('setScale', (u) => {
            var _a, _b, _c;
            setTimeValues((_b = (_a = u.data) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : []);
            setTimeRange((_c = u.scales['x']) !== null && _c !== void 0 ? _c : undefined);
        });
    }, [config]);
    if (timevalues.length < 2 || !onChangeTimeRange) {
        return null;
    }
    if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max) {
        return null;
    }
    // Time values are always sorted for uPlot to work
    let i = 0, j = timevalues.length - 1;
    while (i <= j && timevalues[i] == null) {
        i++;
    }
    while (j >= 0 && timevalues[j] == null) {
        j--;
    }
    const first = timevalues[i];
    const last = timevalues[j];
    const fromX = timeRange.min;
    const toX = timeRange.max;
    if (first == null || last == null) {
        return null;
    }
    // (StartA <= EndB) and (EndA >= StartB)
    if (first <= toX && last >= fromX) {
        return null;
    }
    return (React.createElement("div", { style: {
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '100%',
            textAlign: 'center',
        } },
        React.createElement("div", null,
            React.createElement("div", null, "Data outside time range"),
            React.createElement(Button, { onClick: (v) => onChangeTimeRange({ from: first, to: last }), variant: "secondary", "data-testid": "time-series-zoom-to-data" }, "Zoom to data"))));
};
OutsideRangePlugin.displayName = 'OutsideRangePlugin';
//# sourceMappingURL=OutsideRangePlugin.js.map