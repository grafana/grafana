import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useObservable } from 'react-use';
import { first } from 'rxjs/operators';

import { ContextMenu, MenuItem } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { Scene } from 'app/features/canvas/runtime/scene';

import { activePanelSubject } from './CanvasPanel';
import { LayerActionID } from './types';
import { getElementTypes } from './utils';

type Props = {
  scene: Scene;
};

type AnchorPoint = {
  x: number;
  y: number;
};

export const CanvasContextMenu = ({ scene }: Props) => {
  const activePanel = useObservable(activePanelSubject);
  const inlineEditorOpen = activePanel?.panel.state.openInlineEdit;
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint>({ x: 0, y: 0 });

  const styles = getStyles();

  const selectedElements = scene.selecto?.getSelectedTargets();

  const handleContextMenu = useCallback(
    (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }

      event.preventDefault();
      const shouldSelectElement = event.currentTarget !== scene.div;
      if (shouldSelectElement) {
        scene.select({ targets: [event.currentTarget as HTMLElement | SVGElement] });
      }
      setAnchorPoint({ x: event.pageX, y: event.pageY });
      setIsMenuVisible(true);
    },
    [scene]
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
              activePanel.panel.closeInlineEdit();
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

    const typeOptions = getElementTypes(scene.shouldShowAdvancedTypes);
    const addItemMenuItem = !scene.isPanelEditing && (
      <div className={(styles.menuItem, styles.center)}>
        <AddLayerButton
          options={typeOptions}
          label={'Add item'}
          onChange={(sel) => {
            console.log('yo');
          }}
        />
      </div>
    );
    //   <MenuItem
    //     label="Add item"
    //     icon="plus"
    //     onClick={() => {
    //       console.log('click');
    //     }}
    //     className={styles.menuItem}
    //   />
    // );

    const setBackgroundMenuItem = !scene.isPanelEditing && (
      <MenuItem
        label={'Set background'}
        onClick={() => {
          console.log('Set canvas background');
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

  const contextMenuAction = (actionType: string) => {
    scene.selection.pipe(first()).subscribe((currentSelectedElements) => {
      const currentSelectedElement = currentSelectedElements[0];
      const currentLayer = currentSelectedElement.parent!;

      switch (actionType) {
        case LayerActionID.Delete:
          currentLayer.doAction(LayerActionID.Delete, currentSelectedElement);
          break;
        case LayerActionID.Duplicate:
          currentLayer.doAction(LayerActionID.Duplicate, currentSelectedElement);
          break;
        case LayerActionID.MoveTop:
          currentLayer.doAction(LayerActionID.MoveTop, currentSelectedElement);
          break;
        case LayerActionID.MoveBottom:
          currentLayer.doAction(LayerActionID.MoveBottom, currentSelectedElement);
          break;
      }
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
    max-width: 60ch;
    overflow: hidden;
  `,
  center: css`
    display: flex;
  `,
});
