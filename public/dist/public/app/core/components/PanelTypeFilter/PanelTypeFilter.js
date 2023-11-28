import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { Icon, Button, MultiSelect, useStyles2 } from '@grafana/ui';
import { getAllPanelPluginMeta, getVizPluginMeta, getWidgetPluginMeta } from 'app/features/panel/state/util';
export const PanelTypeFilter = ({ onChange: propsOnChange, maxMenuHeight, isWidget = false }) => {
    const getPluginMetaData = () => {
        if (config.featureToggles.vizAndWidgetSplit) {
            return isWidget ? getWidgetPluginMeta() : getVizPluginMeta();
        }
        else {
            return getAllPanelPluginMeta();
        }
    };
    const plugins = useMemo(getPluginMetaData, [isWidget]);
    const options = useMemo(() => plugins
        .map((p) => ({ label: p.name, imgUrl: p.info.logos.small, value: p }))
        .sort((a, b) => { var _a; return (_a = a.label) === null || _a === void 0 ? void 0 : _a.localeCompare(b.label); }), [plugins]);
    const [value, setValue] = useState([]);
    const onChange = useCallback((plugins) => {
        const changedPlugins = plugins.filter((p) => p.value).map((p) => p.value);
        propsOnChange(changedPlugins);
        setValue(plugins);
    }, [propsOnChange]);
    const styles = useStyles2(getStyles);
    const selectOptions = {
        defaultOptions: true,
        getOptionLabel: (i) => i.label,
        getOptionValue: (i) => i.value,
        noOptionsMessage: 'No Panel types found',
        placeholder: 'Filter by type',
        maxMenuHeight,
        options,
        value,
        onChange,
    };
    return (React.createElement("div", { className: styles.container },
        value.length > 0 && (React.createElement(Button, { size: "xs", icon: "trash-alt", fill: "text", className: styles.clear, onClick: () => onChange([]), "aria-label": "Clear types" }, "Clear types")),
        React.createElement(MultiSelect, Object.assign({}, selectOptions, { prefix: React.createElement(Icon, { name: "filter" }), "aria-label": "Panel Type filter" }))));
};
function getStyles(theme) {
    return {
        container: css `
      label: container;
      position: relative;
      min-width: 180px;
      flex-grow: 1;
    `,
        clear: css `
      label: clear;
      font-size: ${theme.spacing(1.5)};
      position: absolute;
      top: -${theme.spacing(4.5)};
      right: 0;
    `,
    };
}
//# sourceMappingURL=PanelTypeFilter.js.map