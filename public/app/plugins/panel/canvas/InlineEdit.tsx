import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import React, { SyntheticEvent, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Resizable, ResizeCallbackData } from 'react-resizable';

import { Dimensions2D, GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { IconButton, Portal, useStyles } from '@grafana/ui';
import store from 'app/core/store';

import { InlineEditOptions } from './InlineEditOptions';
import { getGlobalStyles } from './globalStyles';

type Props = {
  onClose?: () => void;
};

const OFFSET_X = 70;

export const InlineEdit = ({ onClose }: Props) => {
  const btnInlineEdit = document.querySelector('[data-btninlineedit]')!.getBoundingClientRect();
  const ref = useRef<HTMLDivElement>(null);
  const styles = useStyles(getStyles);
  const inlineEditKey = 'inlineEditPanel';

  const globalCSS = getGlobalStyles(config.theme2);

  const defaultMeasurements = { width: 350, height: 400 };
  const defaultX = btnInlineEdit.x + OFFSET_X;
  const defaultY = btnInlineEdit.y - defaultMeasurements.height;

  const savedPlacement = store.getObject(inlineEditKey, {
    x: defaultX,
    y: defaultY,
    w: defaultMeasurements.width,
    h: defaultMeasurements.height,
  });
  const [measurements, setMeasurements] = useState<Dimensions2D>({ width: savedPlacement.w, height: savedPlacement.h });
  const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });

  const onDragStop = (event: any, dragElement: any) => {
    setPlacement({ x: dragElement.x, y: dragElement.y });
    saveToStore(dragElement.x, dragElement.y, measurements.width, measurements.height);
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
      <Global styles={globalCSS} />
      <Draggable handle="strong" onStop={onDragStop} position={{ x: placement.x, y: savedPlacement.y }}>
        <Resizable height={measurements.height} width={measurements.width} onResize={onResizeStop}>
          <div
            className={cx('box', 'no-cursor', `${styles.inlineEditorContainer}`)}
            style={{ height: `${measurements.height}px`, width: `${measurements.width}px` }}
            ref={ref}
          >
            <strong className={cx('cursor', `${styles.inlineEditorHeader}`)}>
              <div className={styles.placeholder} />
              <div>Canvas Inline Editor</div>
              <IconButton name="times" size="xl" className={styles.inlineEditorClose} onClick={onClose} />
            </strong>
            <div className={styles.inlineEditorContentWrapper}>
              <div className={styles.inlineEditorContent}>
                <InlineEditOptions />
              </div>
            </div>
          </div>
        </Resizable>
      </Draggable>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  inlineEditorContainer: css`
    display: flex;
    flex-direction: column;
    background: ${theme.colors.panelBg};
    box-shadow: 5px 5px 20px -5px #000000;
    z-index: 1000;
    opacity: 1;
  `,
  inlineEditorHeader: css`
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.pageHeaderBg};
    border: 1px solid ${theme.colors.pageHeaderBorder};
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
