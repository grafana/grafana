import React, { createElement } from 'react';
/**
 * Flattens parts into a list of indices pointing to the index where a part
 * (highlighted or not highlighted) starts. Adds extra indices if needed
 * at the beginning or the end to ensure the entire text is covered.
 */
function getStartIndices(parts, length) {
    var indices = [];
    parts.forEach(function (part) {
        indices.push(part.start, part.end + 1);
    });
    if (indices[0] !== 0) {
        indices.unshift(0);
    }
    if (indices[indices.length - 1] !== length) {
        indices.push(length);
    }
    return indices;
}
export var PartialHighlighter = function (props) {
    var highlightParts = props.highlightParts, text = props.text, highlightClassName = props.highlightClassName;
    if (!(highlightParts === null || highlightParts === void 0 ? void 0 : highlightParts.length)) {
        return null;
    }
    var children = [];
    var indices = getStartIndices(highlightParts, text.length);
    var highlighted = highlightParts[0].start === 0;
    for (var i = 1; i < indices.length; i++) {
        var start = indices[i - 1];
        var end = indices[i];
        children.push(createElement(highlighted ? 'mark' : 'span', {
            key: i - 1,
            children: text.substring(start, end),
            className: highlighted ? highlightClassName : undefined,
        }));
        highlighted = !highlighted;
    }
    return React.createElement("div", null, children);
};
//# sourceMappingURL=PartialHighlighter.js.map