import { css } from '@emotion/css';
import React from 'react';
import config from 'app/core/config';
import { ColorDimensionEditor, ScalarDimensionEditor } from 'app/features/dimensions/editors';
import { ServerDatabase } from './types/database';
import { ServerSingle } from './types/single';
import { ServerStack } from './types/stack';
import { ServerTerminal } from './types/terminal';
var ServerType;
(function (ServerType) {
    ServerType["Single"] = "Single";
    ServerType["Stack"] = "Stack";
    ServerType["Database"] = "Database";
    ServerType["Terminal"] = "Terminal";
})(ServerType || (ServerType = {}));
const outlineColor = config.theme2.colors.text.primary;
const ServerDisplay = ({ data }) => {
    return data ? (React.createElement("svg", { viewBox: "0 0 75 75" }, data.type === ServerType.Single ? (React.createElement(ServerSingle, Object.assign({}, data))) : data.type === ServerType.Stack ? (React.createElement(ServerStack, Object.assign({}, data))) : data.type === ServerType.Database ? (React.createElement(ServerDatabase, Object.assign({}, data))) : data.type === ServerType.Terminal ? (React.createElement(ServerTerminal, Object.assign({}, data))) : null)) : null;
};
export const serverItem = {
    id: 'server',
    name: 'Server',
    description: 'Basic server with status',
    display: ServerDisplay,
    defaultSize: {
        width: 100,
        height: 100,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f;
        return (Object.assign(Object.assign({}, options), { background: {
                color: {
                    fixed: 'transparent',
                },
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 100,
                top: (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top,
                left: (_f = options === null || options === void 0 ? void 0 : options.placement) === null || _f === void 0 ? void 0 : _f.left,
            }, config: {
                type: ServerType.Single,
            } }));
    },
    // Called when data changes
    prepareData: (ctx, cfg) => {
        const data = {
            blinkRate: (cfg === null || cfg === void 0 ? void 0 : cfg.blinkRate) ? ctx.getScalar(cfg.blinkRate).value() : 0,
            statusColor: (cfg === null || cfg === void 0 ? void 0 : cfg.statusColor) ? ctx.getColor(cfg.statusColor).value() : 'transparent',
            bulbColor: (cfg === null || cfg === void 0 ? void 0 : cfg.bulbColor) ? ctx.getColor(cfg.bulbColor).value() : 'green',
            type: cfg.type,
        };
        return data;
    },
    registerOptionsUI: (builder) => {
        const category = ['Server'];
        builder
            .addSelect({
            category,
            path: 'config.type',
            name: 'Type',
            settings: {
                options: [
                    { value: ServerType.Single, label: ServerType.Single },
                    { value: ServerType.Stack, label: ServerType.Stack },
                    { value: ServerType.Database, label: ServerType.Database },
                    { value: ServerType.Terminal, label: ServerType.Terminal },
                ],
            },
            defaultValue: ServerType.Single,
        })
            .addCustomEditor({
            category,
            id: 'statusColor',
            path: 'config.statusColor',
            name: 'Status color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                fixed: 'transparent',
            },
        })
            .addCustomEditor({
            category,
            id: 'bulbColor',
            path: 'config.bulbColor',
            name: 'Bulb color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                fixed: 'green',
            },
        })
            .addCustomEditor({
            category,
            id: 'blinkRate',
            path: 'config.blinkRate',
            name: 'Blink rate [hz] (0 = off)',
            editor: ScalarDimensionEditor,
            settings: { min: 0, max: 100 },
        });
    },
};
export const getServerStyles = (data) => (theme) => {
    var _a;
    return ({
        bulb: css `
    @keyframes blink {
      0% {
        fill-opacity: 0;
      }
      50% {
        fill-opacity: 1;
      }
      100% {
        fill-opacity: 0;
      }
    }
  `,
        server: css `
    fill: ${(_a = data === null || data === void 0 ? void 0 : data.statusColor) !== null && _a !== void 0 ? _a : 'transparent'};
  `,
        circle: css `
    animation: blink ${(data === null || data === void 0 ? void 0 : data.blinkRate) ? 1 / data.blinkRate : 0}s infinite step-end;
    fill: ${data === null || data === void 0 ? void 0 : data.bulbColor};
    stroke: none;
  `,
        circleBack: css `
    fill: ${outlineColor};
    stroke: none;
    opacity: 1;
  `,
        outline: css `
    stroke: ${outlineColor};
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4px;
  `,
    });
};
//# sourceMappingURL=server.js.map