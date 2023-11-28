import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { Trans } from 'app/core/internationalization';
import { PlaylistTableRows } from './PlaylistTableRows';
export const PlaylistTable = ({ items, deleteItem, moveItem }) => {
    const onDragEnd = (d) => {
        var _a;
        if (d.destination) {
            moveItem(d.source.index, (_a = d.destination) === null || _a === void 0 ? void 0 : _a.index);
        }
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("h3", { className: "page-headering" },
            React.createElement(Trans, { i18nKey: "playlist-edit.form.table-heading" }, "Dashboards")),
        React.createElement(DragDropContext, { onDragEnd: onDragEnd },
            React.createElement(Droppable, { droppableId: "playlist-list", direction: "vertical" }, (provided) => {
                return (React.createElement("div", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
                    React.createElement(PlaylistTableRows, { items: items, onDelete: deleteItem }),
                    provided.placeholder));
            }))));
};
//# sourceMappingURL=PlaylistTable.js.map