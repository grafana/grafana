import { css } from '@emotion/css';
import React from 'react';
import { CoreApp } from '@grafana/data';
import { FlameGraph } from '@grafana/flamegraph';
import { reportInteraction, config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
function interaction(name, context = {}) {
    reportInteraction(`grafana_flamegraph_${name}`, Object.assign({ app: CoreApp.Unknown, grafana_version: config.buildInfo.version }, context));
}
export const FlameGraphExploreContainer = (props) => {
    const styles = useStyles2((theme) => getStyles(theme));
    return (React.createElement("div", { className: styles.container },
        React.createElement(FlameGraph, { data: props.dataFrames[0], stickyHeader: true, getTheme: () => config.theme2, onTableSymbolClick: () => interaction('table_item_selected'), onViewSelected: (view) => interaction('view_selected', { view }), onTextAlignSelected: (align) => interaction('text_align_selected', { align }), onTableSort: (sort) => interaction('table_sort_selected', { sort }) })));
};
const getStyles = (theme) => ({
    container: css `
    background: ${theme.colors.background.primary};
    display: flow-root;
    padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: ${theme.shape.radius.default};
  `,
});
//# sourceMappingURL=FlameGraphExploreContainer.js.map