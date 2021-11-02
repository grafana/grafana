import React from 'react';
import { css } from '@emotion/css';
import { RadioButtonGroup } from '@grafana/ui';
import { EXPLORE_GRAPH_STYLES } from 'app/core/utils/explore';
var ALL_GRAPH_STYLE_OPTIONS = EXPLORE_GRAPH_STYLES.map(function (style) { return ({
    value: style,
    // capital-case it and switch `_` to ` `
    label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}); });
var spacing = css({
    display: 'flex',
    justifyContent: 'space-between',
});
export function ExploreGraphLabel(props) {
    var graphStyle = props.graphStyle, onChangeGraphStyle = props.onChangeGraphStyle;
    return (React.createElement("div", { className: spacing },
        "Graph",
        React.createElement(RadioButtonGroup, { size: "sm", options: ALL_GRAPH_STYLE_OPTIONS, value: graphStyle, onChange: onChangeGraphStyle })));
}
//# sourceMappingURL=ExploreGraphLabel.js.map