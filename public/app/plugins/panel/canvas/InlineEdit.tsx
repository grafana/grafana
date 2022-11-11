import { css } from '@emotion/css';
import React, { SyntheticEvent, useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Resizable, ResizeCallbackData } from 'react-resizable';

import { Dimensions2D, GrafanaTheme2 } from '@grafana/data';
import { IconButton, Portal, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';
import { Scene } from 'app/features/canvas/runtime/scene';

import { InlineEditBody } from './InlineEditBody';

type Props = {
  onClose?: () => void;
  id: number;
  scene: Scene;
};

const OFFSET_X = 10;
const OFFSET_Y = 32;

export function InlineEdit({ onClose, id, scene }: Props) {
  const root = scene.root.div?.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  const ref = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  const inlineEditKey = 'inlineEditPanel' + id.toString();

  const defaultMeasurements = { width: 400, height: 400 };
  const widthOffset = root?.width ?? defaultMeasurements.width + OFFSET_X * 2;
  const defaultX = root?.x ?? 0 + widthOffset - defaultMeasurements.width - OFFSET_X;
  const defaultY = root?.y ?? 0 + OFFSET_Y;

  const savedPlacement = store.getObject(inlineEditKey, {
    x: defaultX,
    y: defaultY,
    w: defaultMeasurements.width,
    h: defaultMeasurements.height,
  });
  const [measurements, setMeasurements] = useState<Dimensions2D>({ width: savedPlacement.w, height: savedPlacement.h });
  const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });

  // Checks that placement is within browser window
  useEffect(() => {
    const minX = windowWidth - measurements.width - OFFSET_X;
    const minY = windowHeight - measurements.height - OFFSET_Y;
    if (minX < placement.x && minX > 0) {
      setPlacement({ ...placement, x: minX });
    }
    if (minY < placement.y && minY > 0) {
      setPlacement({ ...placement, y: minY });
    }
  }, [windowHeight, windowWidth, placement, measurements]);

  const onDragStop = (event: any, dragElement: any) => {
    let x = dragElement.x < 0 ? 0 : dragElement.x;
    let y = dragElement.y < 0 ? 0 : dragElement.y;

    setPlacement({ x: x, y: y });
    saveToStore(x, y, measurements.width, measurements.height);
  };

  const onResizeStop = (event: SyntheticEvent<Element, Event>, data: ResizeCallbackData) => {
    const { size } = data;
    setMeasurements({ width: size.width, height: size.height });
    saveToStore(placement.x, placement.y, size.width, size.height);
  };

  const saveToStore = (x: number, y: number, width: number, height: number) => {
    store.setObject(inlineEditKey, { x: x, y: y, w: width, h: height });
  };

  return (
    <Portal>
      <div className={styles.draggableWrapper}>
        <Draggable handle="strong" onStop={onDragStop} position={{ x: placement.x, y: placement.y }}>
          <Resizable height={measurements.height} width={measurements.width} onResize={onResizeStop}>
            <div
              className={styles.inlineEditorContainer}
              style={{ height: `${measurements.height}px`, width: `${measurements.width}px` }}
              ref={ref}
            >
              <strong className={styles.inlineEditorHeader}>
                <div className={styles.placeholder} />
                <div>Canvas Inline Editor</div>
                <IconButton name="times" size="xl" className={styles.inlineEditorClose} onClick={onClose} />
              </strong>
              <div className={styles.inlineEditorContentWrapper}>
                <div className={styles.inlineEditorContent}>
                  <InlineEditBody />
                </div>
              </div>
            </div>
          </Resizable>
        </Draggable>
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlineEditorContainer: css`
    display: flex;
    flex-direction: column;
    background: ${theme.components.panel.background};
    border: 1px solid ${theme.colors.border.strong};
    box-shadow: 5px 5px 20px -5px #000000;
    z-index: 1000;
    opacity: 1;
  `,
  draggableWrapper: css`
    width: 0;
    height: 0;
  `,
  inlineEditorHeader: css`
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.background.canvas};
    border: 1px solid ${theme.colors.border.weak};
    height: 40px;
    cursor: move;
  `,
  inlineEditorContent: css`
    white-space: pre-wrap;
    padding: 10px;
  `,
  inlineEditorClose: css`
    margin-left: auto;
  `,
  placeholder: css`
    width: 24px;
    height: 24px;
    visibility: hidden;
    margin-right: auto;
  `,
  inlineEditorContentWrapper: css`
    overflow: scroll;
  `,
});
