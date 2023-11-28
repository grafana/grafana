import { css } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';
import { LayerActionID } from '../../types';
export const TreeNodeTitle = ({ settings, nodeData, setAllowSelection }) => {
    const element = nodeData.dataRef;
    const name = nodeData.dataRef.getName();
    const styles = useStyles2(getStyles);
    const layer = settings.layer;
    const getScene = () => {
        if (!(settings === null || settings === void 0 ? void 0 : settings.layer)) {
            return;
        }
        return settings.layer.scene;
    };
    const onDelete = (element) => {
        var _a;
        const elLayer = (_a = element.parent) !== null && _a !== void 0 ? _a : layer;
        elLayer.doAction(LayerActionID.Delete, element);
        setAllowSelection(false);
    };
    const onDuplicate = (element) => {
        var _a;
        const elLayer = (_a = element.parent) !== null && _a !== void 0 ? _a : layer;
        elLayer.doAction(LayerActionID.Duplicate, element);
        setAllowSelection(false);
    };
    const onNameChange = (element, name) => {
        element.onChange(Object.assign(Object.assign({}, element.options), { name }));
    };
    const verifyLayerNameUniqueness = (nameToVerify) => {
        const scene = getScene();
        return Boolean(scene === null || scene === void 0 ? void 0 : scene.canRename(nameToVerify));
    };
    const getLayerInfo = (element) => {
        return element.options.type;
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(LayerName, { name: name, onChange: (v) => onNameChange(element, v), verifyLayerNameUniqueness: verifyLayerNameUniqueness !== null && verifyLayerNameUniqueness !== void 0 ? verifyLayerNameUniqueness : undefined }),
        React.createElement("div", { className: styles.textWrapper },
            "\u00A0 ",
            getLayerInfo(element)),
        !nodeData.children && (React.createElement("div", { className: styles.actionButtonsWrapper },
            React.createElement(IconButton, { name: "copy", title: "Duplicate", className: styles.actionIcon, onClick: () => onDuplicate(element), tooltip: "Duplicate" }),
            React.createElement(IconButton, { name: "trash-alt", title: "remove", className: styles.actionIcon, onClick: () => onDelete(element), tooltip: "Remove" })))));
};
const getStyles = (theme) => ({
    actionButtonsWrapper: css `
    display: flex;
    align-items: flex-end;
  `,
    actionIcon: css `
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
    textWrapper: css `
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    margin-right: ${theme.spacing(1)};
  `,
    layerName: css `
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.primary.text};
    cursor: pointer;
    overflow: hidden;
    margin-left: ${theme.spacing(0.5)};
  `,
});
//# sourceMappingURL=TreeNodeTitle.js.map