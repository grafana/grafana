import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import React, { useMemo } from 'react';
import { Field, Select, useStyles2 } from '@grafana/ui';
import { getAllDataSources } from '../utils/config';
import { css } from '@emotion/css';
export var AlertManagerPicker = function (_a) {
    var onChange = _a.onChange, current = _a.current, _b = _a.disabled, disabled = _b === void 0 ? false : _b;
    var styles = useStyles2(getStyles);
    var options = useMemo(function () {
        return __spreadArray([
            {
                label: 'Grafana',
                value: GRAFANA_RULES_SOURCE_NAME,
                imgUrl: 'public/img/grafana_icon.svg',
                meta: {},
            }
        ], __read(getAllDataSources()
            .filter(function (ds) { return ds.type === DataSourceType.Alertmanager; })
            .map(function (ds) { return ({
            label: ds.name.substr(0, 37),
            value: ds.name,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }); })), false);
    }, []);
    // no need to show the picker if there's only one option
    if (options.length === 1) {
        return null;
    }
    return (React.createElement(Field, { className: styles.field, label: disabled ? 'Alertmanager' : 'Choose Alertmanager', disabled: disabled, "data-testid": "alertmanager-picker" },
        React.createElement(Select, { menuShouldPortal: true, width: 29, className: "ds-picker select-container", backspaceRemovesValue: false, onChange: function (value) { return value.value && onChange(value.value); }, options: options, maxMenuHeight: 500, noOptionsMessage: "No datasources found", value: current, getOptionLabel: function (o) { return o.label; } })));
};
var getStyles = function (theme) { return ({
    field: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(4)),
}); };
var templateObject_1;
//# sourceMappingURL=AlertManagerPicker.js.map