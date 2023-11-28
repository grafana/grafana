import React from 'react';
import { getTagColorsFromName, Icon } from '@grafana/ui';
export class TagBadge extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const { label, removeIcon, count, onClick } = this.props;
        const { color } = getTagColorsFromName(label);
        const tagStyle = {
            backgroundColor: color,
        };
        const countLabel = count !== 0 && React.createElement("span", { className: "tag-count-label" }, `(${count})`);
        return (React.createElement("span", { className: `label label-tag`, style: tagStyle },
            removeIcon && React.createElement(Icon, { onClick: onClick, name: "times" }),
            label,
            " ",
            countLabel));
    }
}
//# sourceMappingURL=TagBadge.js.map