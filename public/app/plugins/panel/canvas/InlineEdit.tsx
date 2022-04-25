import React, { useRef, useState } from 'react';
import { GrafanaTheme, PanelModel } from '@grafana/data';
import { DashboardModel } from '../../../features/dashboard/state';
import Draggable from 'react-draggable';
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

  const savedPlacement = store.getObject(inlineEditKey, { x: defaultX, y: defaultY });
  // const [measurements, setMeasurements] = useState<Dimensions2D>({ width: defaultMeasurements.width, height: defaultMeasurements.height });
  const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });

  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  const handleStop = (event: any, dragElement: any) => {
    setPlacement({ x: dragElement.x, y: dragElement.y });
    storeInlineEditDetails(dragElement.x, dragElement.y);
  };

  const storeInlineEditDetails = (xVal: number, yVal: number) => {
    store.setObject(inlineEditKey, { x: xVal, y: yVal });
  };

  return (
    <Draggable handle="strong" onStop={handleStop} position={{ x: placement.x, y: savedPlacement.y }}>
      <div className={cx('box', 'no-cursor', `${styles.inlineEditorContainer}`)} ref={ref}>
        <strong className={cx('cursor', `${styles.inlineEditorHeader}`)}>{panel.title}</strong>
        <div style={{ overflow: 'scroll' }}>
          <div className={styles.inlineEditorContent}>
            {selectedElements.map((v, index) => {
              return <span key={index}>{v.getName()}</span>;
            })}
          </div>
        </div>
      </div>
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
