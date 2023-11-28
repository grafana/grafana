import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { config } from '@grafana/runtime';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';
import { filterPluginList, getAllPanelPluginMeta, getVizPluginMeta, getWidgetPluginMeta } from '../../state/util';
import { VizTypePickerPlugin } from './VizTypePickerPlugin';
export function VizTypePicker({ searchQuery, onChange, current, data, isWidget = false }) {
    const styles = useStyles2(getStyles);
    const pluginsList = useMemo(() => {
        if (config.featureToggles.vizAndWidgetSplit) {
            if (isWidget) {
                return getWidgetPluginMeta();
            }
            return getVizPluginMeta();
        }
        return getAllPanelPluginMeta();
    }, [isWidget]);
    const filteredPluginTypes = useMemo(() => {
        return filterPluginList(pluginsList, searchQuery, current);
    }, [current, pluginsList, searchQuery]);
    if (filteredPluginTypes.length === 0) {
        return React.createElement(EmptySearchResult, null, "Could not find anything matching your query");
    }
    return (React.createElement("div", { className: styles.grid }, filteredPluginTypes.map((plugin, index) => (React.createElement(VizTypePickerPlugin, { disabled: false, key: plugin.id, isCurrent: plugin.id === current.id, plugin: plugin, onClick: (e) => onChange({
            pluginId: plugin.id,
            withModKey: Boolean(e.metaKey || e.ctrlKey || e.altKey),
        }) })))));
}
const getStyles = (theme) => {
    return {
        grid: css `
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing(0.5)};
    `,
        heading: css(Object.assign(Object.assign({}, theme.typography.h5), { margin: theme.spacing(0, 0.5, 1) })),
    };
};
//# sourceMappingURL=VizTypePicker.js.map