import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { createFieldConfigRegistry } from '@grafana/data';
import { VerticalGroup, Field, useStyles2 } from '@grafana/ui';
import { defaultSparklineCellConfig } from '@grafana/ui/src/components/Table/SparklineCell';
import { getGraphFieldConfig } from '../../timeseries/config';
const optionIds = [
    'hideValue',
    'drawStyle',
    'lineInterpolation',
    'barAlignment',
    'lineWidth',
    'fillOpacity',
    'gradientMode',
    'lineStyle',
    'spanNulls',
    'showPoints',
    'pointSize',
];
function getChartCellConfig(cfg) {
    const graphFieldConfig = getGraphFieldConfig(cfg);
    return Object.assign(Object.assign({}, graphFieldConfig), { useCustomConfig: (builder) => {
            var _a;
            (_a = graphFieldConfig.useCustomConfig) === null || _a === void 0 ? void 0 : _a.call(graphFieldConfig, builder);
            builder.addBooleanSwitch({
                path: 'hideValue',
                name: 'Hide value',
            });
        } });
}
export const SparklineCellOptionsEditor = (props) => {
    const { cellOptions, onChange } = props;
    const registry = useMemo(() => {
        const config = getChartCellConfig(defaultSparklineCellConfig);
        return createFieldConfigRegistry(config, 'ChartCell');
    }, []);
    const style = useStyles2(getStyles);
    const values = Object.assign(Object.assign({}, defaultSparklineCellConfig), cellOptions);
    return (React.createElement(VerticalGroup, null, registry.list(optionIds.map((id) => `custom.${id}`)).map((item) => {
        var _a;
        if (item.showIf && !item.showIf(values)) {
            return null;
        }
        const Editor = item.editor;
        const path = item.path;
        return (React.createElement(Field, { label: item.name, key: item.id, className: style.field },
            React.createElement(Editor, { onChange: (val) => onChange(Object.assign(Object.assign({}, cellOptions), { [path]: val })), value: (_a = (isOptionKey(path, values) ? values[path] : undefined)) !== null && _a !== void 0 ? _a : item.defaultValue, item: item, context: { data: [] } })));
    })));
};
// jumping through hoops to avoid using "any"
function isOptionKey(key, options) {
    return key in options;
}
const getStyles = () => ({
    field: css `
    width: 100%;

    // @TODO don't show "scheme" option for custom gradient mode.
    // it needs thresholds to work, which are not supported
    // for area chart cell right now
    [title='Use color scheme to define gradient'] {
      display: none;
    }
  `,
});
//# sourceMappingURL=SparklineCellOptionsEditor.js.map