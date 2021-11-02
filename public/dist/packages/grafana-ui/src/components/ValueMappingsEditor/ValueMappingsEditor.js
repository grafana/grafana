import { __read } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { MappingType } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { css } from '@emotion/css';
import { buildEditRowModels, editModelToSaveModel, ValueMappingsEditorModal } from './ValueMappingsEditorModal';
import { Icon } from '../Icon/Icon';
import { VerticalGroup } from '../Layout/Layout';
import { ColorPicker } from '../ColorPicker/ColorPicker';
export var ValueMappingsEditor = React.memo(function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var styles = useStyles2(getStyles);
    var _b = __read(useState(false), 2), isEditorOpen = _b[0], setIsEditorOpen = _b[1];
    var onCloseEditor = useCallback(function () {
        setIsEditorOpen(false);
    }, [setIsEditorOpen]);
    var rows = useMemo(function () { return buildEditRowModels(value); }, [value]);
    var onChangeColor = useCallback(function (color, index) {
        rows[index].result.color = color;
        onChange(editModelToSaveModel(rows));
    }, [rows, onChange]);
    return (React.createElement(VerticalGroup, null,
        React.createElement("table", { className: styles.compactTable },
            React.createElement("tbody", null, rows.map(function (row, rowIndex) { return (React.createElement("tr", { key: rowIndex.toString() },
                React.createElement("td", null,
                    row.type === MappingType.ValueToText && row.key,
                    row.type === MappingType.RangeToText && (React.createElement("span", null,
                        "[",
                        row.from,
                        " - ",
                        row.to,
                        "]")),
                    row.type === MappingType.RegexToText && row.pattern,
                    row.type === MappingType.SpecialValue && row.specialMatch),
                React.createElement("td", null,
                    React.createElement(Icon, { name: "arrow-right" })),
                React.createElement("td", null, row.result.text),
                React.createElement("td", null, row.result.color && (React.createElement(ColorPicker, { color: row.result.color, onChange: function (color) { return onChangeColor(color, rowIndex); }, enableNamedColors: true }))))); }))),
        React.createElement(Button, { variant: "secondary", size: "sm", fullWidth: true, onClick: function () { return setIsEditorOpen(true); } },
            rows.length > 0 && React.createElement("span", null, "Edit value mappings"),
            rows.length === 0 && React.createElement("span", null, "Add value mappings")),
        React.createElement(Modal, { isOpen: isEditorOpen, title: "Value mappings", onDismiss: onCloseEditor, className: styles.modal, closeOnBackdropClick: false },
            React.createElement(ValueMappingsEditorModal, { value: value, onChange: onChange, onClose: onCloseEditor }))));
});
ValueMappingsEditor.displayName = 'ValueMappingsEditor';
export var getStyles = function (theme) { return ({
    modal: css({
        width: '980px',
    }),
    compactTable: css({
        width: '100%',
        'tbody td': {
            padding: theme.spacing(0.5),
        },
    }),
}); };
//# sourceMappingURL=ValueMappingsEditor.js.map