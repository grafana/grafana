import React, { useRef, useState } from 'react';
import { Dimensions2D, GrafanaTheme, PanelModel } from '@grafana/data';
import { DashboardModel } from '../../../features/dashboard/state';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { stylesFactory, useTheme } from '@grafana/ui/src';
import { cx, css } from '@emotion/css';
import { useClickAway } from 'react-use';
import { ElementState } from '../../../features/canvas/runtime/element';
import store from 'app/core/store';

type Props = {
  onClose?: () => void;
  panel: PanelModel;
  dashboard: DashboardModel;
  selectedElements: ElementState[];
};

const OFFSET = 8;

export const InlineEdit = ({ panel, dashboard, onClose, selectedElements }: Props) => {
  const theme = useTheme();
  const btnInlineEdit = document.querySelector(`[data-btninlineedit="${panel.id}"]`)!.getBoundingClientRect();
  const ref = useRef<HTMLDivElement>(null);
  const styles = getStyles(theme);
  const inlineEditKey = `inlineEditPanel-${panel.id}`;

  const defaultMeasurements = { width: 350, height: 400 };
  const defaultX = btnInlineEdit.x - btnInlineEdit.width + OFFSET;
  const defaultY = -OFFSET - defaultMeasurements.height;

  const savedPlacement = store.getObject(inlineEditKey, {
    x: defaultX,
    y: defaultY,
    w: defaultMeasurements.width,
    h: defaultMeasurements.height,
  });
  const [measurements, setMeasurements] = useState<Dimensions2D>({ width: savedPlacement.w, height: savedPlacement.h });
  const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });

  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  const onDragStop = (event: any, dragElement: any) => {
    setPlacement({ x: dragElement.x, y: dragElement.y });
    saveToStore(dragElement.x, dragElement.y, measurements.width, measurements.height);
  };

  const onResizeStop = (event: React.MouseEvent, { size }) => {
    setMeasurements({ width: size.width, height: size.height });
    saveToStore(placement.x, placement.y, size.width, size.height);
  };

  const saveToStore = (x: number, y: number, width: number, height: number) => {
    store.setObject(inlineEditKey, { x: x, y: y, w: width, h: height });
  };

  return (
    <Draggable handle="strong" onStop={onDragStop} position={{ x: placement.x, y: savedPlacement.y }}>
      <Resizable height={measurements.height} width={measurements.width} onResize={onResizeStop}>
        <div
          className={cx('box', 'no-cursor', `${styles.inlineEditorContainer}`)}
          style={{ height: `${measurements.height}px`, width: `${measurements.width}px` }}
          ref={ref}
        >
          <strong className={cx('cursor', `${styles.inlineEditorHeader}`)}>{panel.title}</strong>
          <div style={{ overflow: 'scroll' }}>
            <div className={styles.inlineEditorContent}>
              {selectedElements.map((v, index) => {
                return <span key={index}>{v.getName()}</span>;
              })}
            </div>
          </div>
        </div>
      </Resizable>
    </Draggable>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  inlineEditorContainer: css`
    display: flex;
    flex-direction: column;
    position: absolute;
    background: ${theme.colors.panelBg};
    box-shadow: 5px 5px 20px -5px #000000;
    width: 350px;
    height: 400px;
    z-index: 100000;
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
}));
