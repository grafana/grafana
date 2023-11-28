import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useToggle, useWindowSize } from 'react-use';
import { applyFieldOverrides } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, useTheme2, PanelChrome } from '@grafana/ui';
import { NodeGraph } from '../../../plugins/panel/nodeGraph';
import { useCategorizeFrames } from '../../../plugins/panel/nodeGraph/useCategorizeFrames';
import { useLinks } from '../utils/links';
const getStyles = (theme) => ({
    warningText: css `
    label: warningText;
    display: flex;
    align-items: center;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});
export function UnconnectedNodeGraphContainer(props) {
    var _a;
    const { dataFrames, range, splitOpenFn, withTraceView, datasourceType } = props;
    const getLinks = useLinks(range, splitOpenFn);
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    // This is implicit dependency that is needed for links to work. At some point when replacing variables in the link
    // it requires field to have a display property which is added by the overrides even though we don't add any field
    // overrides in explore.
    const frames = applyFieldOverrides({
        fieldConfig: {
            defaults: {},
            overrides: [],
        },
        data: dataFrames,
        // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
        replaceVariables: (value) => value,
        theme,
    });
    const { nodes } = useCategorizeFrames(frames);
    const [collapsed, toggleCollapsed] = useToggle(true);
    const toggled = () => {
        toggleCollapsed();
        reportInteraction('grafana_traces_node_graph_panel_clicked', {
            datasourceType: datasourceType,
            grafana_version: config.buildInfo.version,
            isExpanded: !open,
        });
    };
    // Calculate node graph height based on window and top position, with some padding
    const { height: windowHeight } = useWindowSize();
    const containerRef = useRef(null);
    const [top, setTop] = useState(250);
    useEffect(() => {
        if (containerRef.current) {
            const { top } = containerRef.current.getBoundingClientRect();
            setTop(top);
        }
    }, [containerRef]);
    const height = windowHeight - top - 32;
    const countWarning = withTraceView && ((_a = nodes[0]) === null || _a === void 0 ? void 0 : _a.length) > 1000 ? (React.createElement("span", { className: styles.warningText },
        " (",
        nodes[0].length,
        " nodes, can be slow to load)")) : null;
    return (React.createElement(PanelChrome, { title: `Node graph`, titleItems: countWarning, 
        // We allow collapsing this only when it is shown together with trace view.
        collapsible: !!withTraceView, collapsed: withTraceView ? collapsed : false, onToggleCollapse: withTraceView ? toggled : undefined },
        React.createElement("div", { ref: containerRef, style: withTraceView
                ? { height: 500 }
                : {
                    minHeight: 600,
                    height,
                } },
            React.createElement(NodeGraph, { dataFrames: frames, getLinks: getLinks }))));
}
function mapStateToProps(state, { exploreId }) {
    return {
        range: state.explore.panes[exploreId].range,
    };
}
const connector = connect(mapStateToProps, {});
export const NodeGraphContainer = connector(UnconnectedNodeGraphContainer);
//# sourceMappingURL=NodeGraphContainer.js.map