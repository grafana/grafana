import { __awaiter } from "tslib";
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Label, Select } from '@grafana/ui';
import { SimulationSchemaForm } from './SimulationSchemaForm';
export const SimulationQueryEditor = ({ onChange, query, ds }) => {
    var _a, _b, _c, _d, _e, _f;
    const simQuery = (_a = query.sim) !== null && _a !== void 0 ? _a : {};
    const simKey = (_b = simQuery.key) !== null && _b !== void 0 ? _b : {};
    // keep track of updated config state to pass down to form
    const [cfgValue, setCfgValue] = useState({});
    // This only changes once
    const info = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const v = yield ds.getResource('sims');
        return {
            sims: v,
            options: v.map((s) => ({ label: s.name, value: s.type, description: s.description })),
        };
    }), [ds]);
    const current = useMemo(() => {
        const type = simKey.type;
        if (!type || !info.value) {
            return {};
        }
        return {
            details: info.value.sims.find((v) => v.type === type),
            option: info.value.options.find((v) => v.value === type),
        };
    }, [info.value, simKey === null || simKey === void 0 ? void 0 : simKey.type]);
    let config = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        var _g;
        let path = simKey.type + '/' + simKey.tick + 'hz';
        if (simKey.uid) {
            path += '/' + simKey.uid;
        }
        let config = (_g = (yield ds.getResource('sim/' + path))) === null || _g === void 0 ? void 0 : _g.config;
        setCfgValue(config.value);
        return config;
    }), [simKey.type, simKey.tick, simKey.uid]);
    const onUpdateKey = (key) => {
        onChange(Object.assign(Object.assign({}, query), { sim: Object.assign(Object.assign({}, simQuery), { key }) }));
    };
    const onUIDChanged = (e) => {
        const { value } = e.currentTarget;
        onUpdateKey(Object.assign(Object.assign({}, simKey), { uid: value !== null && value !== void 0 ? value : undefined }));
    };
    const onTickChanged = (e) => {
        const tick = e.currentTarget.valueAsNumber;
        onUpdateKey(Object.assign(Object.assign({}, simKey), { tick }));
    };
    const onTypeChange = (v) => {
        onUpdateKey(Object.assign(Object.assign({}, simKey), { type: v.value }));
    };
    const onToggleStream = () => {
        onChange(Object.assign(Object.assign({}, query), { sim: Object.assign(Object.assign({}, simQuery), { stream: !simQuery.stream }) }));
    };
    const onToggleLast = () => {
        onChange(Object.assign(Object.assign({}, query), { sim: Object.assign(Object.assign({}, simQuery), { last: !simQuery.last }) }));
    };
    const onSchemaFormChange = (config) => {
        let path = simKey.type + '/' + simKey.tick + 'hz';
        if (simKey.uid) {
            path += '/' + simKey.uid;
        }
        ds.postResource('sim/' + path, config).then((res) => {
            setCfgValue(res.config);
        });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Simulation", tooltip: "" },
                React.createElement(Select, { isLoading: info.loading, options: (_d = (_c = info.value) === null || _c === void 0 ? void 0 : _c.options) !== null && _d !== void 0 ? _d : [], value: current.option, onChange: onTypeChange, width: 32 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Stream", tooltip: "connect to the live channel" },
                React.createElement(InlineSwitch, { value: Boolean(simQuery.stream), onChange: onToggleStream })),
            React.createElement(InlineField, { label: "Interval", tooltip: "the rate a simulation will spit out events" },
                React.createElement(Input, { width: 10, type: "number", value: simKey.tick, onChange: onTickChanged, min: 1 / 10, max: 50, suffix: "hz" })),
            React.createElement(InlineField, { label: "Last", tooltip: "Only return the last value" },
                React.createElement(Label, null,
                    React.createElement(InlineSwitch, { value: Boolean(simQuery.last), onChange: onToggleLast }))),
            React.createElement(InlineField, { label: "UID", tooltip: "A UID will allow multiple simulations to run at the same time" },
                React.createElement(Input, { type: "text", placeholder: "optional", value: simQuery.key.uid, onChange: onUIDChanged }))),
        React.createElement(SimulationSchemaForm, { onChange: onSchemaFormChange, config: cfgValue !== null && cfgValue !== void 0 ? cfgValue : config.value, schema: (_f = (_e = current.details) === null || _e === void 0 ? void 0 : _e.config.schema) !== null && _f !== void 0 ? _f : { fields: [] } })));
};
//# sourceMappingURL=SimulationQueryEditor.js.map