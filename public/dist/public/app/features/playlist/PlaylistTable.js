import React from 'react';
import { PlaylistTableRows } from './PlaylistTableRows';
export var PlaylistTable = function (_a) {
    var items = _a.items, onMoveUp = _a.onMoveUp, onMoveDown = _a.onMoveDown, onDelete = _a.onDelete;
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("h3", { className: "page-headering" }, "Dashboards"),
        React.createElement("table", { className: "filter-table" },
            React.createElement("tbody", null,
                React.createElement(PlaylistTableRows, { items: items, onMoveUp: onMoveUp, onMoveDown: onMoveDown, onDelete: onDelete })))));
};
//# sourceMappingURL=PlaylistTable.js.map