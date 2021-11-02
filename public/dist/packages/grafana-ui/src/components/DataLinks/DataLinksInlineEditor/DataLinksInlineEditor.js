import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Button } from '../../Button/Button';
import { cloneDeep } from 'lodash';
import { Modal } from '../../Modal/Modal';
import { stylesFactory, useTheme2 } from '../../../themes';
import { DataLinksListItem } from './DataLinksListItem';
import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
export var DataLinksInlineEditor = function (_a) {
    var links = _a.links, onChange = _a.onChange, getSuggestions = _a.getSuggestions, data = _a.data;
    var theme = useTheme2();
    var _b = __read(useState(null), 2), editIndex = _b[0], setEditIndex = _b[1];
    var _c = __read(useState(false), 2), isNew = _c[0], setIsNew = _c[1];
    var styles = getDataLinksInlineEditorStyles(theme);
    var linksSafe = links !== null && links !== void 0 ? links : [];
    var isEditing = editIndex !== null;
    var onDataLinkChange = function (index, link) {
        if (isNew) {
            if (link.title.trim() === '' && link.url.trim() === '') {
                setIsNew(false);
                setEditIndex(null);
                return;
            }
            else {
                setEditIndex(null);
                setIsNew(false);
            }
        }
        var update = cloneDeep(linksSafe);
        update[index] = link;
        onChange(update);
        setEditIndex(null);
    };
    var onDataLinkAdd = function () {
        var update = cloneDeep(linksSafe);
        setEditIndex(update.length);
        setIsNew(true);
    };
    var onDataLinkCancel = function (index) {
        if (isNew) {
            setIsNew(false);
        }
        setEditIndex(null);
    };
    var onDataLinkRemove = function (index) {
        var update = cloneDeep(linksSafe);
        update.splice(index, 1);
        onChange(update);
    };
    return (React.createElement(React.Fragment, null,
        linksSafe.length > 0 && (React.createElement("div", { className: styles.wrapper }, linksSafe.map(function (l, i) {
            return (React.createElement(DataLinksListItem, { key: l.title + "/" + i, index: i, link: l, onChange: onDataLinkChange, onEdit: function () { return setEditIndex(i); }, onRemove: function () { return onDataLinkRemove(i); }, data: data }));
        }))),
        isEditing && editIndex !== null && (React.createElement(Modal, { title: "Edit link", isOpen: true, closeOnBackdropClick: false, onDismiss: function () {
                onDataLinkCancel(editIndex);
            } },
            React.createElement(DataLinkEditorModalContent, { index: editIndex, link: isNew ? { title: '', url: '' } : linksSafe[editIndex], data: data, onSave: onDataLinkChange, onCancel: onDataLinkCancel, getSuggestions: getSuggestions }))),
        React.createElement(Button, { size: "sm", icon: "plus", onClick: onDataLinkAdd, variant: "secondary" }, "Add link")));
};
var getDataLinksInlineEditorStyles = stylesFactory(function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(2)),
    };
});
var templateObject_1;
//# sourceMappingURL=DataLinksInlineEditor.js.map