import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { first } from 'rxjs/operators';

import { ContextMenu, MenuItem } from '@grafana/ui';

import { Scene } from '../../../features/canvas/runtime/scene';

import { LayerActionID } from './types';

type Props = {
  scene: Scene;
};

type AnchorPoint = {
  x: number;
  y: number;
};

export const CanvasContextMenu = ({ scene }: Props) => {
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint>({ x: 0, y: 0 });

  const styles = getStyles();

  const selectedElements = scene.selecto?.getSelectedTargets();

  useEffect(() => {
    const handleMouseEvent = (e: MouseEvent) => {
      e.preventDefault();
      if (e.currentTarget) {
        scene.select({ targets: [e.currentTarget as HTMLElement | SVGElement] });
      }
      setAnchorPoint({ x: e.pageX, y: e.pageY });
      setIsMenuVisible(true);
      scene.showContextMenu.next(true);
    };

    if (selectedElements) {
      if (selectedElements.length === 1) {
        const element = selectedElements[0];
        element.addEventListener('contextmenu', (ev) => handleMouseEvent(ev as MouseEvent));
      }
    }
  }, [scene, selectedElements]);

  if (!selectedElements) {
    return <></>;
  }

  const closeContextMenu = () => {
    setIsMenuVisible(false);
    scene.showContextMenu.next(false);
  };

  const renderMenuItems = () => {
    return (
      <>
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
      </>
    );
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
      <ContextMenu
        x={anchorPoint.x}
        y={anchorPoint.y}
        onClose={closeContextMenu}
        renderMenuItems={renderMenuItems}
        focusOnOpen={false}
      />
    );
  }

  return <></>;
};

const getStyles = () => ({
  menuItem: css`
    max-width: 60ch;
    overflow: hidden;
  `,
});
