import React, { useEffect, useState } from 'react';
import { onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { InlineField, SecretInput, Input, InlineFieldRow, InlineLabel } from '@grafana/ui';
export const addMetaData = (setMetaData, metaDataArr) => {
    setMetaData([...metaDataArr, { key: '', value: '' }]);
};
export const removeMetaData = (i, setMetaData, metaDataArr) => {
    const newMetaValues = [...metaDataArr];
    newMetaValues.splice(i, 1);
    setMetaData(newMetaValues);
};
export const onKeyChange = (key, metaDataArr, index, setMetaData) => {
    const newMetaValues = [...metaDataArr];
    newMetaValues[index]['key'] = key;
    setMetaData(newMetaValues);
};
export const onValueChange = (value, metaDataArr, index, setMetaData) => {
    const newMetaValues = [...metaDataArr];
    newMetaValues[index]['value'] = value;
    setMetaData(newMetaValues);
};
export const InfluxSqlConfig = (props) => {
    var _a, _b;
    const { options: { jsonData, secureJsonData, secureJsonFields }, } = props;
    const existingMetadata = ((_a = jsonData === null || jsonData === void 0 ? void 0 : jsonData.metadata) === null || _a === void 0 ? void 0 : _a.length)
        ? (_b = jsonData === null || jsonData === void 0 ? void 0 : jsonData.metadata) === null || _b === void 0 ? void 0 : _b.map((md) => ({ key: Object.keys(md)[0], value: Object.values(md)[0] }))
        : [{ key: 'bucket-name', value: '' }];
    const [metaDataArr, setMetaData] = useState(existingMetadata);
    useEffect(() => {
        const { onOptionsChange, options } = props;
        const mapData = metaDataArr === null || metaDataArr === void 0 ? void 0 : metaDataArr.map((m) => ({ [m.key]: m.value }));
        const jsonData = Object.assign(Object.assign({}, options.jsonData), { metadata: mapData });
        onOptionsChange(Object.assign(Object.assign({}, options), { jsonData }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metaDataArr]);
    return (React.createElement("div", null,
        React.createElement("div", { className: "gf-form" },
            React.createElement("h6", null, "Token")),
        React.createElement("div", null,
            React.createElement(InlineField, { labelWidth: 20, label: "Token" },
                React.createElement(SecretInput, { width: 40, name: "token", type: "text", value: (secureJsonData === null || secureJsonData === void 0 ? void 0 : secureJsonData.token) || '', onReset: () => updateDatasourcePluginResetOption(props, 'token'), onChange: onUpdateDatasourceSecureJsonDataOption(props, 'token'), isConfigured: secureJsonFields === null || secureJsonFields === void 0 ? void 0 : secureJsonFields.token }))),
        React.createElement("div", null,
            React.createElement("div", { className: "gf-form" },
                React.createElement("h6", null, "MetaData")), metaDataArr === null || metaDataArr === void 0 ? void 0 :
            metaDataArr.map((_, i) => {
                var _a, _b, _c, _d;
                return (React.createElement(InlineFieldRow, { key: i, style: { flexFlow: 'row' } },
                    React.createElement(InlineField, { labelWidth: 20, label: "Key" },
                        React.createElement(Input, { key: i, width: 40, name: "key", type: "text", value: ((_a = metaDataArr[i]) === null || _a === void 0 ? void 0 : _a.key) || '', placeholder: "key", onChange: (e) => onKeyChange(e.currentTarget.value, metaDataArr, i, setMetaData) })),
                    React.createElement(InlineField, { labelWidth: 20, label: "Value" },
                        React.createElement(Input, { key: i, width: 40, name: "value", type: "text", value: (_d = (_c = (_b = metaDataArr[i]) === null || _b === void 0 ? void 0 : _b.value) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : '', placeholder: "value", onChange: (e) => onValueChange(e.currentTarget.value, metaDataArr, i, setMetaData) })),
                    i + 1 >= metaDataArr.length && (React.createElement(InlineLabel, { as: "button", className: "", onClick: () => addMetaData(setMetaData, metaDataArr), width: "auto" }, "+")),
                    i > 0 && (React.createElement(InlineLabel, { as: "button", className: "", width: "auto", onClick: () => removeMetaData(i, setMetaData, metaDataArr) }, "-"))));
            }))));
};
//# sourceMappingURL=InfluxSQLConfig.js.map