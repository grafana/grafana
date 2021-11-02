import React from 'react';
import { PlaylistTableRow } from './PlaylistTableRow';
export var PlaylistTableRows = function (_a) {
    var items = _a.items, onMoveUp = _a.onMoveUp, onMoveDown = _a.onMoveDown, onDelete = _a.onDelete;
    if (items.length === 0) {
        return (React.createElement("tr", null,
            React.createElement("td", null,
                React.createElement("em", null, "Playlist is empty. Add dashboards below."))));
    }
    return (React.createElement(React.Fragment, null, items.map(function (item, index) {
        var first = index === 0;
        var last = index === items.length - 1;
        return (React.createElement(PlaylistTableRow, { first: first, last: last, item: item, onDelete: onDelete, onMoveDown: onMoveDown, onMoveUp: onMoveUp, key: item.title }));
    })));
};
//# sourceMappingURL=PlaylistTableRows.js.map