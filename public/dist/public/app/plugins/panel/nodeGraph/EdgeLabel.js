import { css } from '@emotion/css';
import React, { memo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { nodeR } from './Node';
import { shortenLine } from './utils';
const getStyles = (theme) => {
    return {
        mainGroup: css `
      pointer-events: none;
      font-size: 8px;
    `,
        background: css `
      fill: ${theme.components.tooltip.background};
    `,
        text: css `
      fill: ${theme.components.tooltip.text};
    `,
    };
};
export const EdgeLabel = memo(function EdgeLabel(props) {
    const { edge } = props;
    // Not great typing, but after we do layout these properties are full objects not just references
    const { source, target, sourceNodeRadius, targetNodeRadius } = edge;
    // As the nodes have some radius we want edges to end outside the node circle.
    const line = shortenLine({
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
    }, sourceNodeRadius || nodeR, targetNodeRadius || nodeR);
    const middle = {
        x: line.x1 + (line.x2 - line.x1) / 2,
        y: line.y1 + (line.y2 - line.y1) / 2,
    };
    const styles = useStyles2(getStyles);
    const stats = [edge.mainStat, edge.secondaryStat].filter((x) => x);
    const height = stats.length > 1 ? '30' : '15';
    const middleOffset = stats.length > 1 ? 15 : 7.5;
    let offset = stats.length > 1 ? -5 : 2.5;
    const contents = [];
    stats.forEach((stat, index) => {
        contents.push(React.createElement("text", { key: index, className: styles.text, x: middle.x, y: middle.y + offset, textAnchor: 'middle' }, stat));
        offset += 15;
    });
    return (React.createElement("g", { className: styles.mainGroup },
        React.createElement("rect", { className: styles.background, x: middle.x - 40, y: middle.y - middleOffset, width: "80", height: height, rx: "5" }),
        contents));
});
//# sourceMappingURL=EdgeLabel.js.map