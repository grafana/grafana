import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { useToggle } from 'react-use';
import { Badge, Collapse, useStyles2, useTheme2 } from '@grafana/ui';
import { applyFieldOverrides } from '@grafana/data';
import { css } from '@emotion/css';
import { splitOpen } from './state/main';
import { connect } from 'react-redux';
import { useLinks } from './utils/links';
import { NodeGraph } from '../../plugins/panel/nodeGraph';
import { useCategorizeFrames } from '../../plugins/panel/nodeGraph/useCategorizeFrames';
var getStyles = function (theme) { return ({
    warningText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: warningText;\n    font-size: ", ";\n    color: ", ";\n  "], ["\n    label: warningText;\n    font-size: ", ";\n    color: ", ";\n  "])), theme.typography.bodySmall.fontSize, theme.colors.text.secondary),
}); };
export function UnconnectedNodeGraphContainer(props) {
    var _a;
    var dataFrames = props.dataFrames, range = props.range, splitOpen = props.splitOpen, withTraceView = props.withTraceView;
    var getLinks = useLinks(range, splitOpen);
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    // This is implicit dependency that is needed for links to work. At some point when replacing variables in the link
    // it requires field to have a display property which is added by the overrides even though we don't add any field
    // overrides in explore.
    var frames = applyFieldOverrides({
        fieldConfig: {
            defaults: {},
            overrides: [],
        },
        data: dataFrames,
        // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
        replaceVariables: function (value) { return value; },
        theme: theme,
    });
    var nodes = useCategorizeFrames(frames).nodes;
    var _b = __read(useToggle(false), 2), open = _b[0], toggleOpen = _b[1];
    var countWarning = withTraceView && ((_a = nodes[0]) === null || _a === void 0 ? void 0 : _a.length) > 1000 ? (React.createElement("span", { className: styles.warningText },
        " (",
        nodes[0].length,
        " nodes, can be slow to load)")) : null;
    return (React.createElement(Collapse, { label: React.createElement("span", null,
            "Node graph",
            countWarning,
            ' ',
            React.createElement(Badge, { text: 'Beta', color: 'blue', icon: 'rocket', tooltip: 'This visualization is in beta' })), collapsible: withTraceView, 
        // We allow collapsing this only when it is shown together with trace view.
        isOpen: withTraceView ? open : true, onToggle: withTraceView ? function () { return toggleOpen(); } : undefined },
        React.createElement("div", { style: { height: withTraceView ? 500 : 600 } },
            React.createElement(NodeGraph, { dataFrames: frames, getLinks: getLinks }))));
}
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    return {
        range: state.explore[exploreId].range,
    };
}
var mapDispatchToProps = {
    splitOpen: splitOpen,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var NodeGraphContainer = connector(UnconnectedNodeGraphContainer);
var templateObject_1;
//# sourceMappingURL=NodeGraphContainer.js.map