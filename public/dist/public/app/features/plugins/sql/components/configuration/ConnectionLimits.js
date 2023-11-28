import React from 'react';
import { ConfigSubSection, Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Field, Icon, InlineLabel, Input, Label, Switch, Tooltip } from '@grafana/ui';
function toNumber(text) {
    if (text.trim() === '') {
        // calling `Number('')` returns zero,
        // so we have to handle this case
        return NaN;
    }
    return Number(text);
}
export const ConnectionLimits = (props) => {
    const { onOptionsChange, options } = props;
    const jsonData = options.jsonData;
    const autoIdle = jsonData.maxIdleConnsAuto !== undefined ? jsonData.maxIdleConnsAuto : false;
    // Update JSON data with new values
    const updateJsonData = (values) => {
        const newOpts = Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, jsonData), values) });
        return onOptionsChange(newOpts);
    };
    // For the case of idle connections and connection lifetime
    // use a shared function to update respective properties
    const onJSONDataNumberChanged = (property) => {
        return (number) => {
            updateJsonData({ [property]: number });
        };
    };
    // When the maximum number of connections is changed
    // see if we have the automatic idle option enabled
    const onMaxConnectionsChanged = (number) => {
        if (autoIdle && number) {
            updateJsonData({
                maxOpenConns: number,
                maxIdleConns: number,
            });
        }
        else {
            updateJsonData({
                maxOpenConns: number,
            });
        }
    };
    // Update auto idle setting when control is toggled
    // and set minimum idle connections if automatic
    // is selected
    const onConnectionIdleAutoChanged = () => {
        let idleConns = undefined;
        let maxConns = undefined;
        // If the maximum number of open connections is undefined
        // and we're setting auto idle then set the default amount
        // otherwise take the numeric amount and get the value from that
        if (!autoIdle) {
            if (jsonData.maxOpenConns !== undefined) {
                maxConns = jsonData.maxOpenConns;
                idleConns = jsonData.maxOpenConns;
            }
        }
        else {
            maxConns = jsonData.maxOpenConns;
            idleConns = jsonData.maxIdleConns;
        }
        updateJsonData({
            maxIdleConnsAuto: !autoIdle,
            maxIdleConns: idleConns,
            maxOpenConns: maxConns,
        });
    };
    const labelWidth = 40;
    return (React.createElement(ConfigSubSection, { title: "Connection limits" },
        React.createElement(Field, { label: React.createElement(Label, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Max open"),
                    React.createElement(Tooltip, { content: React.createElement("span", null,
                            "The maximum number of open connections to the database. If ",
                            React.createElement("i", null, "Max idle connections"),
                            " is greater than 0 and the ",
                            React.createElement("i", null, "Max open connections"),
                            " is less than ",
                            React.createElement("i", null, "Max idle connections"),
                            ", then",
                            React.createElement("i", null, "Max idle connections"),
                            " will be reduced to match the ",
                            React.createElement("i", null, "Max open connections"),
                            " limit. If set to 0, there is no limit on the number of open connections.") },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
            React.createElement(Input, { type: "number", placeholder: "unlimited", defaultValue: jsonData.maxOpenConns, onChange: (e) => {
                    const newVal = toNumber(e.currentTarget.value);
                    if (!Number.isNaN(newVal)) {
                        onMaxConnectionsChanged(newVal);
                    }
                }, width: labelWidth })),
        React.createElement(Field, { label: React.createElement(Label, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Auto Max Idle"),
                    React.createElement(Tooltip, { content: React.createElement("span", null,
                            "If enabled, automatically set the number of ",
                            React.createElement("i", null, "Maximum idle connections"),
                            " to the same value as",
                            React.createElement("i", null, " Max open connections"),
                            ". If the number of maximum open connections is not set it will be set to the default (",
                            config.sqlConnectionLimits.maxIdleConns,
                            ").") },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
            React.createElement(Switch, { value: autoIdle, onChange: onConnectionIdleAutoChanged })),
        React.createElement(Field, { label: React.createElement(Label, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Max idle"),
                    React.createElement(Tooltip, { content: React.createElement("span", null,
                            "The maximum number of connections in the idle connection pool.If ",
                            React.createElement("i", null, "Max open connections"),
                            " is greater than 0 but less than the ",
                            React.createElement("i", null, "Max idle connections"),
                            ", then the ",
                            React.createElement("i", null, "Max idle connections"),
                            ' ',
                            "will be reduced to match the ",
                            React.createElement("i", null, "Max open connections"),
                            " limit. If set to 0, no idle connections are retained.") },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))) }, autoIdle ? (React.createElement(InlineLabel, { width: labelWidth }, options.jsonData.maxIdleConns)) : (React.createElement(Input, { type: "number", placeholder: "2", defaultValue: jsonData.maxIdleConns, onChange: (e) => {
                const newVal = toNumber(e.currentTarget.value);
                if (!Number.isNaN(newVal)) {
                    onJSONDataNumberChanged('maxIdleConns')(newVal);
                }
            }, width: labelWidth, disabled: autoIdle }))),
        React.createElement(Field, { label: React.createElement(Label, null,
                React.createElement(Stack, { gap: 0.5 },
                    React.createElement("span", null, "Max lifetime"),
                    React.createElement(Tooltip, { content: React.createElement("span", null, "The maximum amount of time in seconds a connection may be reused. If set to 0, connections are reused forever.") },
                        React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
            React.createElement(Input, { type: "number", placeholder: "14400", defaultValue: jsonData.connMaxLifetime, onChange: (e) => {
                    const newVal = toNumber(e.currentTarget.value);
                    if (!Number.isNaN(newVal)) {
                        onJSONDataNumberChanged('connMaxLifetime')(newVal);
                    }
                }, width: labelWidth }))));
};
//# sourceMappingURL=ConnectionLimits.js.map