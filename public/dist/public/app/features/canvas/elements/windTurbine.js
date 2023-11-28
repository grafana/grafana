import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { ScalarDimensionEditor } from 'app/features/dimensions/editors';
import { defaultBgColor } from '../element';
const WindTurbineDisplay = ({ data }) => {
    const styles = useStyles2(getStyles);
    const windTurbineAnimation = `spin ${(data === null || data === void 0 ? void 0 : data.rpm) ? 60 / Math.abs(data.rpm) : 0}s linear infinite`;
    return (React.createElement("svg", { viewBox: "0 0 189.326 283.989", preserveAspectRatio: "xMidYMid meet", style: { fill: defaultBgColor } },
        React.createElement("symbol", { id: "blade" },
            React.createElement("path", { fill: "#e6e6e6", id: "blade-front", d: "M14.6491879,1.85011601 C14.2684455,-0.0535962877 10.7150812,-0.815081206 9.06473318,3.37308585 L0.434338747,70.7658933 L8.93805104,91.9607889 L15.4106729,90.437819 L17.5684455,78.3807425 L14.5218097,1.97679814 L14.6491879,1.85011601 Z" }),
            React.createElement("path", { fill: "#d0d6d7", id: "blade-side", d: "M11.0951276,0.581206497 C10.3336427,0.961948956 9.57215777,1.85011601 8.93735499,3.24640371 L0.306960557,70.6392111 L8.81067285,91.8341067 L3.35359629,70.0044084 L11.0951276,0.581206497 Z" })),
        React.createElement("g", null,
            React.createElement("g", { id: "structure", transform: "translate(58.123, 82.664)", fillRule: "nonzero" },
                React.createElement("polygon", { id: "tower", fill: "#e6e6e6", points: "33.111,10.984 39.965,10.984 44.28,196.176 28.796,196.176" }),
                React.createElement("path", { id: "yaw", fill: "rgba(0,0,0,0.25)", d: "M40.3454756,23.2948956 L40.7262181,34.8445476 C38.8225058,35.0986079 35.7765661,35.0986079 32.349884,34.337123 L32.7306265,23.2955916 L40.3454756,23.2955916 L40.3454756,23.2948956 Z" }),
                React.createElement("path", { id: "base", fill: "#d0d6d7", transform: "translate(0 42)", d: "M26.3846868,150.591647 L46.5640371,150.591647 C48.8484919,150.591647 50.7522042,152.49536 50.7522042,154.779814 L50.7522042,158.967981 L22.0691415,158.967981 L22.0691415,154.779814 C22.0691415,152.49536 23.9728538,150.591647 26.2573086,150.591647 L26.3846868,150.591647 Z" }),
                React.createElement("circle", { id: "nacelle", fill: "#e6e6e6", cx: "36.54", cy: "12", r: "11.93" }),
                React.createElement("circle", { id: "gearbox", fill: "none", stroke: "#d0d6d7", strokeWidth: "2.75", cx: "36.538", cy: "11.999", r: "5.8" })),
            React.createElement("g", { className: styles.blade, style: { animation: windTurbineAnimation } },
                React.createElement("use", { id: "blade1", href: "#blade", x: "83.24", y: "0" }),
                React.createElement("use", { id: "blade2", href: "#blade", x: "83.24", y: "0", transform: "rotate(120 94.663 94.663)" }),
                React.createElement("use", { id: "blade3", href: "#blade", x: "83.24", y: "0", transform: "rotate(-120 94.663 94.663)" })))));
};
export const windTurbineItem = {
    id: 'windTurbine',
    name: 'Wind Turbine',
    description: 'Spinny spinny',
    display: WindTurbineDisplay,
    defaultSize: {
        width: 100,
        height: 155,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f;
        return (Object.assign(Object.assign({}, options), { background: {
                color: {
                    fixed: 'transparent',
                },
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 155,
                top: (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top,
                left: (_f = options === null || options === void 0 ? void 0 : options.placement) === null || _f === void 0 ? void 0 : _f.left,
            } }));
    },
    // Called when data changes
    prepareData: (ctx, cfg) => {
        const data = {
            rpm: (cfg === null || cfg === void 0 ? void 0 : cfg.rpm) ? ctx.getScalar(cfg.rpm).value() : 0,
        };
        return data;
    },
    registerOptionsUI: (builder) => {
        const category = ['Wind Turbine'];
        builder.addCustomEditor({
            category,
            id: 'rpm',
            path: 'config.rpm',
            name: 'RPM',
            editor: ScalarDimensionEditor,
        });
    },
};
const getStyles = (theme) => ({
    blade: css `
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    transform-origin: 94.663px 94.663px;
    transform: rotate(15deg);
  `,
});
//# sourceMappingURL=windTurbine.js.map