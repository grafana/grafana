import { css } from '@emotion/css';
import React, { memo } from 'react';
import { useStyles2 } from '@grafana/ui';
const nodeR = 40;
const getStyles = (theme) => ({
    mainGroup: css `
    cursor: pointer;
    font-size: 10px;
  `,
    mainCircle: css `
    fill: ${theme.components.panel.background};
    stroke: ${theme.colors.border.strong};
  `,
    text: css `
    width: 50px;
    height: 50px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
});
export const Marker = memo(function Marker(props) {
    const { marker, onClick } = props;
    const { node } = marker;
    const styles = useStyles2(getStyles);
    if (!(node.x !== undefined && node.y !== undefined)) {
        return null;
    }
    return (React.createElement("g", { "data-node-id": node.id, className: styles.mainGroup, onClick: (event) => {
            onClick === null || onClick === void 0 ? void 0 : onClick(event, marker);
        }, "aria-label": `Hidden nodes marker: ${node.id}` },
        React.createElement("circle", { className: styles.mainCircle, r: nodeR, cx: node.x, cy: node.y }),
        React.createElement("g", null,
            React.createElement("foreignObject", { x: node.x - 25, y: node.y - 25, width: "50", height: "50" },
                React.createElement("div", { className: styles.text },
                    React.createElement("span", null,
                        marker.count > 100 ? '>100' : marker.count,
                        " nodes"))))));
});
//# sourceMappingURL=Marker.js.map