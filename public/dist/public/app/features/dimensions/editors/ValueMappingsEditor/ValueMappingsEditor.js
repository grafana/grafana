import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { MappingType } from '@grafana/data';
import { useStyles2, VerticalGroup, Icon, ColorPicker, Button, Modal } from '@grafana/ui';
import { MediaType, ResourceFolderName, ResourcePickerSize } from '../../types';
import { ResourcePicker } from '../ResourcePicker';
import { buildEditRowModels, editModelToSaveModel, ValueMappingsEditorModal } from './ValueMappingsEditorModal';
export const ValueMappingsEditor = React.memo((props) => {
    var _a;
    const { value, onChange, item } = props;
    const styles = useStyles2(getStyles);
    const showIconPicker = (_a = item.settings) === null || _a === void 0 ? void 0 : _a.icon;
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const onCloseEditor = useCallback(() => {
        setIsEditorOpen(false);
    }, [setIsEditorOpen]);
    const rows = useMemo(() => buildEditRowModels(value), [value]);
    const onChangeColor = useCallback((color, index) => {
        rows[index].result.color = color;
        onChange(editModelToSaveModel(rows));
    }, [rows, onChange]);
    const onChangeIcon = useCallback((icon, index) => {
        rows[index].result.icon = icon;
        onChange(editModelToSaveModel(rows));
    }, [rows, onChange]);
    return (React.createElement(VerticalGroup, null,
        React.createElement("table", { className: styles.compactTable },
            React.createElement("tbody", null, rows.map((row, rowIndex) => (React.createElement("tr", { key: rowIndex.toString() },
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
                row.result.color && (React.createElement("td", null,
                    React.createElement(ColorPicker, { color: row.result.color, onChange: (color) => onChangeColor(color, rowIndex), enableNamedColors: true }))),
                showIconPicker && row.result.icon && (React.createElement("td", { "data-testid": "iconPicker" },
                    React.createElement(ResourcePicker, { onChange: (icon) => onChangeIcon(icon, rowIndex), value: row.result.icon, size: ResourcePickerSize.SMALL, folderName: ResourceFolderName.Icon, mediaType: MediaType.Icon, color: row.result.color })))))))),
        React.createElement(Button, { variant: "secondary", size: "sm", fullWidth: true, onClick: () => setIsEditorOpen(true) },
            rows.length > 0 && React.createElement("span", null, "Edit value mappings"),
            rows.length === 0 && React.createElement("span", null, "Add value mappings")),
        React.createElement(Modal, { isOpen: isEditorOpen, title: "Value mappings", onDismiss: onCloseEditor, className: styles.modal, closeOnBackdropClick: false },
            React.createElement(ValueMappingsEditorModal, { value: value, onChange: onChange, onClose: onCloseEditor, showIconPicker: showIconPicker }))));
});
ValueMappingsEditor.displayName = 'ValueMappingsEditor';
export const getStyles = (theme) => ({
    modal: css({
        width: '980px',
    }),
    compactTable: css({
        width: '100%',
        'tbody td': {
            padding: theme.spacing(0.5),
        },
    }),
});
//# sourceMappingURL=ValueMappingsEditor.js.map