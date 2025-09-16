import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import { first } from 'rxjs/operators';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ContextMenu, MenuItem, MenuItemProps } from '@grafana/ui';
import { config } from 'app/core/config';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';
import { findElementByTarget } from 'app/features/canvas/runtime/sceneElementManagement';

import { CanvasPanel } from '../CanvasPanel';
import { AnchorPoint, LayerActionID } from '../types';
import { getElementTypes, onAddItem } from '../utils';

type Props = {
  scene: Scene;
  panel: CanvasPanel;
  onVisibilityChange: (v: boolean) => void;
};

export const CanvasContextMenu = ({ scene, panel, onVisibilityChange }: Props) => {
  const inlineEditorOpen = panel.state.openInlineEdit;
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint>({ x: 0, y: 0 });

  const styles = getStyles();

  const selectedElements = scene.selecto?.getSelectedTargets();
  const rootLayer: FrameState | undefined = panel.context?.instanceState?.layer;

  useEffect(() => {
    if (config.featureToggles.canvasPanelPanZoom) {
      scene.openContextMenu = (position: AnchorPoint) => {
        setAnchorPoint(position);
        setIsMenuVisible(true);
        onVisibilityChange(true);
      };

      // Clean up the openContextMenu on unmount
      return () => (scene.openContextMenu = undefined);
    }
    return undefined;
  }, [scene, onVisibilityChange]);

  const handleContextMenu = useCallback(
    (event: Event) => {
      if (!(event instanceof MouseEvent) || event.ctrlKey) {
        return;
      }

      event.preventDefault();
      panel.setActivePanel();

      const shouldSelectElement = config.featureToggles.canvasPanelPanZoom
        ? event.currentTarget !== scene.viewportDiv
        : event.currentTarget !== scene.div;
      if (
        shouldSelectElement &&
        (event.currentTarget instanceof HTMLElement || event.currentTarget instanceof SVGElement)
      ) {
        scene.select({ targets: [event.currentTarget] });
      }
      setAnchorPoint({ x: event.pageX, y: event.pageY });
      setIsMenuVisible(true);
      onVisibilityChange(true);
    },
    [scene, panel, onVisibilityChange]
  );

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
    onVisibilityChange(false);
  };

  const renderMenuItems = () => {
    // This is disabled when panel is in edit mode because opening inline editor over panel editor is not ideal UX
    const openCloseEditorMenuItem = !scene.isPanelEditing && (
      <MenuItem
        label={
          inlineEditorOpen
            ? t('canvas.canvas-context-menu.close-editor', 'Close Editor')
            : t('canvas.canvas-context-menu.open-editor', 'Open Editor')
        }
        onClick={() => {
          if (scene.inlineEditingCallback) {
            if (inlineEditorOpen) {
              panel.closeInlineEdit();
            } else {
              scene.inlineEditingCallback();
            }
          }
          closeContextMenu();
        }}
        className={styles.menuItem}
      />
    );

    const editElementMenuItem = () => {
      if (selectedElements?.length === 1) {
        const onClickEditElementMenuItem = () => {
          scene.editModeEnabled.next(true);
          closeContextMenu();
        };

        const element = findElementByTarget(selectedElements[0], scene.root.elements);
        return (
          element &&
          element.item.hasEditMode && (
            <MenuItem
              label={t('canvas.canvas-context-menu.render-menu-items.edit-element-menu-item.label-edit', 'Edit')}
              onClick={onClickEditElementMenuItem}
              className={styles.menuItem}
            />
          )
        );
      }
      return null;
    };

    const typeOptions = getElementTypes(scene.shouldShowAdvancedTypes).options;

    const getTypeOptionsSubmenu = () => {
      const submenuItems: Array<
        React.ReactElement<MenuItemProps<unknown>, string | React.JSXElementConstructor<unknown>>
      > = [];

      const onClickItem = (option: SelectableValue<string>) => {
        let offsetY = anchorPoint.y;
        let offsetX = anchorPoint.x;
        if (scene.div) {
          const transformScale = scene.scale;
          const sceneContainerDimensions = scene.div.getBoundingClientRect();
          offsetY = (offsetY - sceneContainerDimensions.top) / transformScale;
          offsetX = (offsetX - sceneContainerDimensions.left) / transformScale;
        } else if (scene.viewportDiv) {
          const sceneContainerDimensions = scene.viewportDiv.getBoundingClientRect();
          offsetY -= sceneContainerDimensions.top;
          offsetX -= sceneContainerDimensions.left;
        }

        onAddItem(option, rootLayer, {
          ...anchorPoint,
          y: offsetY,
          x: offsetX,
        });
      };

      typeOptions.map((option) => {
        submenuItems.push(
          <MenuItem key={option.value} label={option.label ?? 'Canvas item'} onClick={() => onClickItem(option)} />
        );
      });

      return submenuItems;
    };

    const addItemMenuItem = (
      <MenuItem
        label={t('canvas.canvas-context-menu.render-menu-items.add-item-menu-item.label-add-item', 'Add item')}
        className={styles.menuItem}
        childItems={getTypeOptionsSubmenu()}
        customSubMenuContainerStyles={{ maxHeight: '150px', overflowY: 'auto' }}
      />
    );

    const setBackgroundMenuItem = (
      <MenuItem
        label={t(
          'canvas.canvas-context-menu.render-menu-items.set-background-menu-item.label-set-background',
          'Set background'
        )}
        onClick={() => {
          if (scene.setBackgroundCallback) {
            scene.setBackgroundCallback(anchorPoint);
          }
          closeContextMenu();
        }}
        className={styles.menuItem}
      />
    );

    if (selectedElements && selectedElements.length >= 1) {
      return (
        <>
          {editElementMenuItem()}
          <MenuItem
            label={t('canvas.canvas-context-menu.render-menu-items.label-delete', 'Delete')}
            onClick={() => {
              contextMenuAction(LayerActionID.Delete);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label={t('canvas.canvas-context-menu.render-menu-items.label-duplicate', 'Duplicate')}
            onClick={() => {
              contextMenuAction(LayerActionID.Duplicate);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label={t('canvas.canvas-context-menu.render-menu-items.label-bring-to-front', 'Bring to front')}
            onClick={() => {
              contextMenuAction(LayerActionID.MoveTop);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label={t('canvas.canvas-context-menu.render-menu-items.label-send-to-back', 'Send to back')}
            onClick={() => {
              contextMenuAction(LayerActionID.MoveBottom);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          {openCloseEditorMenuItem}
        </>
      );
    } else {
      return (
        <>
          {openCloseEditorMenuItem}
          {setBackgroundMenuItem}
          {addItemMenuItem}
        </>
      );
    }
  };

  const contextMenuAction = (actionType: LayerActionID) => {
    scene.selection.pipe(first()).subscribe((currentSelectedElements) => {
      const currentLayer = currentSelectedElements[0].parent!;
      currentSelectedElements.forEach((currentSelectedElement: ElementState) => {
        currentLayer.doAction(actionType, currentSelectedElement);
      });
    });

    setTimeout(() => {
      scene.addToSelection();
      scene.targetsToSelect.clear();
    });
  };

  if (isMenuVisible) {
    return (
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          closeContextMenu();
        }}
      >
        <ContextMenu
          x={anchorPoint.x}
          y={anchorPoint.y}
          onClose={closeContextMenu}
          renderMenuItems={renderMenuItems}
          focusOnOpen={false}
        />
      </div>
    );
  }

  return <></>;
};

const getStyles = () => ({
  menuItem: css({
    maxWidth: '200px',
  }),
});
