import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { EXPLORE_GRAPH_STYLES } from 'app/types';
const ALL_GRAPH_STYLE_OPTIONS = EXPLORE_GRAPH_STYLES.map((style) => ({
    value: style,
    // capital-case it and switch `_` to ` `
    label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));
export function ExploreGraphLabel(props) {
    const { graphStyle, onChangeGraphStyle } = props;
    return (React.createElement(RadioButtonGroup, { size: "sm", options: ALL_GRAPH_STYLE_OPTIONS, value: graphStyle, onChange: onChangeGraphStyle }));
}
//# sourceMappingURL=ExploreGraphLabel.js.map