import { __assign } from "tslib";
import React from 'react';
import { config } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { TagFilter } from '../../core/components/TagFilter/TagFilter';
import { SearchSrv } from '../../core/services/search_srv';
import { usePlaylistItems } from './usePlaylistItems';
import { PlaylistTable } from './PlaylistTable';
import { DashboardPickerByID } from 'app/core/components/editors/DashboardPickerByID';
var searchSrv = new SearchSrv();
export var PlaylistForm = function (_a) {
    var onSubmit = _a.onSubmit, playlist = _a.playlist;
    var name = playlist.name, interval = playlist.interval, propItems = playlist.items;
    var _b = usePlaylistItems(propItems), items = _b.items, addById = _b.addById, addByTag = _b.addByTag, deleteItem = _b.deleteItem, moveDown = _b.moveDown, moveUp = _b.moveUp;
    return (React.createElement(React.Fragment, null,
        React.createElement(Form, { onSubmit: function (list) { return onSubmit(__assign(__assign({}, list), { items: items })); }, validateOn: 'onBlur' }, function (_a) {
            var _b, _c;
            var register = _a.register, errors = _a.errors;
            var isDisabled = items.length === 0 || Object.keys(errors).length > 0;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Name", invalid: !!errors.name, error: (_b = errors === null || errors === void 0 ? void 0 : errors.name) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(Input, __assign({ type: "text" }, register('name', { required: 'Name is required' }), { placeholder: "Name", defaultValue: name, "aria-label": selectors.pages.PlaylistForm.name }))),
                React.createElement(Field, { label: "Interval", invalid: !!errors.interval, error: (_c = errors === null || errors === void 0 ? void 0 : errors.interval) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(Input, __assign({ type: "text" }, register('interval', { required: 'Interval is required' }), { placeholder: "5m", defaultValue: interval !== null && interval !== void 0 ? interval : '5m', "aria-label": selectors.pages.PlaylistForm.interval }))),
                React.createElement(PlaylistTable, { items: items, onMoveUp: moveUp, onMoveDown: moveDown, onDelete: deleteItem }),
                React.createElement("div", { className: "gf-form-group" },
                    React.createElement("h3", { className: "page-headering" }, "Add dashboards"),
                    React.createElement(Field, { label: "Add by title" },
                        React.createElement(DashboardPickerByID, { onChange: addById, id: "dashboard-picker", isClearable: true })),
                    React.createElement(Field, { label: "Add by tag" },
                        React.createElement(TagFilter, { isClearable: true, tags: [], hideValues: true, tagOptions: searchSrv.getDashboardTags, onChange: addByTag, placeholder: '' }))),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { variant: "primary", disabled: isDisabled }, "Save"),
                    React.createElement(LinkButton, { variant: "secondary", href: config.appSubUrl + "/playlists" }, "Cancel"))));
        })));
};
//# sourceMappingURL=PlaylistForm.js.map