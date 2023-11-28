import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { first } from 'rxjs/operators';
import { ContextMenu, MenuItem } from '@grafana/ui';
import { LayerActionID } from '../types';
import { getElementTypes, onAddItem } from '../utils';
export const CanvasContextMenu = ({ scene, panel }) => {
    var _a, _b, _c;
    const inlineEditorOpen = panel.state.openInlineEdit;
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
    const styles = getStyles();
    const selectedElements = (_a = scene.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets();
    const rootLayer = (_c = (_b = panel.context) === null || _b === void 0 ? void 0 : _b.instanceState) === null || _c === void 0 ? void 0 : _c.layer;
    const handleContextMenu = useCallback((event) => {
        if (!(event instanceof MouseEvent)) {
            return;
        }
        event.preventDefault();
        panel.setActivePanel();
        const shouldSelectElement = event.currentTarget !== scene.div;
        if (shouldSelectElement &&
            (event.currentTarget instanceof HTMLElement || event.currentTarget instanceof SVGElement)) {
            scene.select({ targets: [event.currentTarget] });
        }
        setAnchorPoint({ x: event.pageX, y: event.pageY });
        setIsMenuVisible(true);
    }, [scene, panel]);
    useEffect(() => {
        if (scene.selecto) {
            scene.selecto.getSelectableElements().forEach((element) => {
                element.addEventListener('contextmenu', handleContextMenu);
            });
        }
    }, [handleContextMenu, scene.selecto]);
    useEffect(() => {
        if (scene.div) {
            scene.div.addEventListener('contextmenu', handleContextMenu);
        }
    }, [handleContextMenu, scene.div]);
    const closeContextMenu = () => {
        setIsMenuVisible(false);
    };
    const renderMenuItems = () => {
        const openCloseEditorMenuItem = !scene.isPanelEditing && (React.createElement(MenuItem, { label: inlineEditorOpen ? 'Close Editor' : 'Open Editor', onClick: () => {
                if (scene.inlineEditingCallback) {
                    if (inlineEditorOpen) {
                        panel.closeInlineEdit();
                    }
                    else {
                        scene.inlineEditingCallback();
                    }
                }
                closeContextMenu();
            }, className: styles.menuItem }));
        const editElementMenuItem = () => {
            if ((selectedElements === null || selectedElements === void 0 ? void 0 : selectedElements.length) === 1) {
                const onClickEditElementMenuItem = () => {
                    scene.editModeEnabled.next(true);
                    closeContextMenu();
                };
                const element = scene.findElementByTarget(selectedElements[0]);
                return (element &&
                    element.item.hasEditMode && (React.createElement(MenuItem, { label: "Edit", onClick: onClickEditElementMenuItem, className: styles.menuItem })));
            }
            return null;
        };
        const typeOptions = getElementTypes(scene.shouldShowAdvancedTypes).options;
        const getTypeOptionsSubmenu = () => {
            const submenuItems = [];
            const onClickItem = (option) => {
                let offsetY = anchorPoint.y;
                let offsetX = anchorPoint.x;
                if (scene.div) {
                    const sceneContainerDimensions = scene.div.getBoundingClientRect();
                    offsetY = offsetY - sceneContainerDimensions.top;
                    offsetX = offsetX - sceneContainerDimensions.left;
                }
                onAddItem(option, rootLayer, Object.assign(Object.assign({}, anchorPoint), { y: offsetY, x: offsetX }));
            };
            typeOptions.map((option) => {
                var _a;
                submenuItems.push(React.createElement(MenuItem, { key: option.value, label: (_a = option.label) !== null && _a !== void 0 ? _a : 'Canvas item', onClick: () => onClickItem(option) }));
            });
            return submenuItems;
        };
        const addItemMenuItem = !scene.isPanelEditing && (React.createElement(MenuItem, { label: "Add item", className: styles.menuItem, childItems: getTypeOptionsSubmenu(), customSubMenuContainerStyles: { maxHeight: '150px', overflowY: 'auto' } }));
        const setBackgroundMenuItem = !scene.isPanelEditing && (React.createElement(MenuItem, { label: 'Set background', onClick: () => {
                if (scene.setBackgroundCallback) {
                    scene.setBackgroundCallback(anchorPoint);
                }
                closeContextMenu();
            }, className: styles.menuItem }));
        if (selectedElements && selectedElements.length >= 1) {
            return (React.createElement(React.Fragment, null,
                editElementMenuItem(),
                React.createElement(MenuItem, { label: "Delete", onClick: () => {
                        contextMenuAction(LayerActionID.Delete);
                        closeContextMenu();
                    }, className: styles.menuItem }),
                React.createElement(MenuItem, { label: "Duplicate", onClick: () => {
                        contextMenuAction(LayerActionID.Duplicate);
                        closeContextMenu();
                    }, className: styles.menuItem }),
                React.createElement(MenuItem, { label: "Bring to front", onClick: () => {
                        contextMenuAction(LayerActionID.MoveTop);
                        closeContextMenu();
                    }, className: styles.menuItem }),
                React.createElement(MenuItem, { label: "Send to back", onClick: () => {
                        contextMenuAction(LayerActionID.MoveBottom);
                        closeContextMenu();
                    }, className: styles.menuItem }),
                openCloseEditorMenuItem));
        }
        else {
            return (React.createElement(React.Fragment, null,
                openCloseEditorMenuItem,
                setBackgroundMenuItem,
                addItemMenuItem));
        }
    };
    const contextMenuAction = (actionType) => {
        scene.selection.pipe(first()).subscribe((currentSelectedElements) => {
            const currentLayer = currentSelectedElements[0].parent;
            currentSelectedElements.forEach((currentSelectedElement) => {
                currentLayer.doAction(actionType, currentSelectedElement);
            });
        });
        setTimeout(() => {
            scene.addToSelection();
            scene.targetsToSelect.clear();
        });
    };
    if (isMenuVisible) {
        return (React.createElement("div", { onContextMenu: (event) => {
                event.preventDefault();
                closeContextMenu();
            } },
            React.createElement(ContextMenu, { x: anchorPoint.x, y: anchorPoint.y, onClose: closeContextMenu, renderMenuItems: renderMenuItems, focusOnOpen: false })));
    }
    return React.createElement(React.Fragment, null);
};
const getStyles = () => ({
    menuItem: css `
    max-width: 200px;
  `,
});
//# sourceMappingURL=CanvasContextMenu.js.map