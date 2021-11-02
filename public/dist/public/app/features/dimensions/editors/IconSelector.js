import { __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { Select } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
var IconSelector = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var _b = __read(useState(value ? [{ value: value, label: value }] : []), 2), icons = _b[0], setIcons = _b[1];
    var _c = __read(useState(), 2), icon = _c[0], setIcon = _c[1];
    var iconRoot = window.__grafana_public_path__ + 'img/icons/unicons/';
    var onChangeIcon = function (value) {
        onChange(value);
        setIcon(value);
    };
    useEffect(function () {
        getBackendSrv()
            .get(iconRoot + "/index.json")
            .then(function (data) {
            setIcons(data.files.map(function (icon) { return ({
                value: icon,
                label: icon,
            }); }));
        });
    }, [iconRoot]);
    return (React.createElement(Select, { menuShouldPortal: true, options: icons, value: icon, onChange: function (selectedValue) {
            onChangeIcon(selectedValue.value);
        } }));
};
export default IconSelector;
//# sourceMappingURL=IconSelector.js.map