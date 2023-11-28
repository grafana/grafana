import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { ScalarDimensionEditor } from 'app/features/dimensions/editors';
import { defaultBgColor } from '../element';
const DroneSideDisplay = ({ data }) => {
    const styles = useStyles2(getStyles);
    const droneSidePitchTransformStyle = `rotate(${(data === null || data === void 0 ? void 0 : data.pitchAngle) ? data.pitchAngle : 0}deg)`;
    return (React.createElement("svg", { className: styles.droneSide, xmlns: "http://www.w3.org/2000/svg", xmlnsXlink: "http://www.w3.org/1999/xlink", viewBox: "0 0 1300 290", style: { transform: droneSidePitchTransformStyle, stroke: defaultBgColor } },
        React.createElement("g", { className: "arms", stroke: defaultBgColor, strokeWidth: "28px" },
            React.createElement("line", { x1: "510", x2: "320", y1: "100", y2: "150" }),
            React.createElement("line", { x1: "510", x2: "320", y1: "190", y2: "210" }),
            React.createElement("line", { x1: "790", x2: "980", y1: "190", y2: "210" }),
            React.createElement("line", { x1: "790", x2: "980", y1: "100", y2: "150" })),
        React.createElement("g", { className: "body", stroke: defaultBgColor, strokeWidth: "28px" },
            React.createElement("path", { fill: "none", d: " M 510 130 C 510 124 510 110 510 100 C 510 90 530 71 540 70 C 640 61 670 60 760 70 C 770 71 790 90 790 100 Q 790 120 790 130 L 790 130 Q 790 177 790 196 C 790 207 770 225 760 226 C 670 236 640 236 540 226 C 530 226 510 206 510 196 Q 510 177 510 130 Q 510 133 510 130 Z " })),
        React.createElement("g", { className: "motors", stroke: defaultBgColor, strokeWidth: "28px" },
            React.createElement("path", { className: "motor", fill: "none", d: " M 320 60 L 250 60 L 250 230 L 260 290 L 310 290 L 320 230 L 320 60 Z " }),
            React.createElement("path", { className: "motor", fill: "none", d: " M 1050 60 L 980 60 L 980 230 L 990 290 L 1040 290 L 1050 230 L 1050 60 Z " })),
        React.createElement("g", { className: "propellers", fill: defaultBgColor },
            React.createElement("path", { className: "prop", d: " M 270 60 L 300 60 L 300 20 Q 311 30 330 30 Q 349 30 570 10 L 300 10 Q 300 0 290 0 C 286 0 284 0 280 0 Q 270 0 270 10 L 0 10 Q 220 30 240 30 Q 260 30 270 20 L 270 60 Z " }),
            React.createElement("path", { className: "prop", d: " M 1000 60 L 1030 60 L 1030 20 Q 1041 30 1060 30 Q 1079 30 1300 10 L 1030 10 Q 1030 0 1020 0 C 1016 0 1014 0 1010 0 Q 1000 0 1000 10 L 730 10 Q 950 30 970 30 Q 990 30 1000 20 L 1000 60 Z " }))));
};
export const droneSideItem = {
    id: 'droneSide',
    name: 'Drone Side',
    description: 'Drone Side',
    display: DroneSideDisplay,
    defaultSize: {
        width: 100,
        height: 26,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f;
        return (Object.assign(Object.assign({}, options), { background: {
                color: {
                    fixed: 'transparent',
                },
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 26,
                top: (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top,
                left: (_f = options === null || options === void 0 ? void 0 : options.placement) === null || _f === void 0 ? void 0 : _f.left,
            } }));
    },
    // Called when data changes
    prepareData: (ctx, cfg) => {
        const data = {
            pitchAngle: (cfg === null || cfg === void 0 ? void 0 : cfg.pitchAngle) ? ctx.getScalar(cfg.pitchAngle).value() : 0,
        };
        return data;
    },
    registerOptionsUI: (builder) => {
        const category = ['Drone Side'];
        builder.addCustomEditor({
            category,
            id: 'pitchAngle',
            path: 'config.pitchAngle',
            name: 'Pitch Angle',
            editor: ScalarDimensionEditor,
        });
    },
};
const getStyles = (theme) => ({
    droneSide: css `
    transition: transform 0.4s;
  `,
});
//# sourceMappingURL=droneSide.js.map