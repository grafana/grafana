import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { first } from 'rxjs/operators';

import { SelectableValue } from '@grafana/data';
import { ContextMenu, MenuItem, MenuItemProps } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';

import { CanvasPanel } from '../CanvasPanel';
import { AnchorPoint, LayerActionID } from '../types';
import { getElementTypes, onAddItem } from '../utils';

type Props = {
  scene: Scene;
  panel: CanvasPanel;
};

export const CanvasContextMenu = ({ scene, panel }: Props) => {
  const inlineEditorOpen = panel.state.openInlineEdit;
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint>({ x: 0, y: 0 });

  const styles = getStyles();

  const selectedElements = scene.selecto?.getSelectedTargets();
  const rootLayer: FrameState | undefined = panel.context?.instanceState?.layer;

  const handleContextMenu = useCallback(
    (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }

      event.preventDefault();
      panel.setActivePanel();

      const shouldSelectElement = event.currentTarget !== scene.div;
      if (
        shouldSelectElement &&
        (event.currentTarget instanceof HTMLElement || event.currentTarget instanceof SVGElement)
      ) {
        scene.select({ targets: [event.currentTarget] });
      }
      setAnchorPoint({ x: event.pageX, y: event.pageY });
      setIsMenuVisible(true);
    },
    [scene, panel]
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
  };

  const renderMenuItems = () => {
    const openCloseEditorMenuItem = !scene.isPanelEditing && (
      <MenuItem
        label={inlineEditorOpen ? 'Close Editor' : 'Open Editor'}
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

        const element = scene.findElementByTarget(selectedElements[0]);
        return (
          element &&
          element.item.hasEditMode && (
            <MenuItem label="Edit" onClick={onClickEditElementMenuItem} className={styles.menuItem} />
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
          const sceneContainerDimensions = scene.div.getBoundingClientRect();
          offsetY = offsetY - sceneContainerDimensions.top;
          offsetX = offsetX - sceneContainerDimensions.left;
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

    const addItemMenuItem = !scene.isPanelEditing && (
      <MenuItem
        label="Add item"
        className={styles.menuItem}
        childItems={getTypeOptionsSubmenu()}
        customSubMenuContainerStyles={{ maxHeight: '150px', overflowY: 'auto' }}
      />
    );

    const setBackgroundMenuItem = !scene.isPanelEditing && (
      <MenuItem
        label={'Set background'}
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
            label="Delete"
            onClick={() => {
              contextMenuAction(LayerActionID.Delete);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label="Duplicate"
            onClick={() => {
              contextMenuAction(LayerActionID.Duplicate);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label="Bring to front"
            onClick={() => {
              contextMenuAction(LayerActionID.MoveTop);
              closeContextMenu();
            }}
            className={styles.menuItem}
          />
          <MenuItem
            label="Send to back"
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
  menuItem: css`
    max-width: 200px;
  `,
});
