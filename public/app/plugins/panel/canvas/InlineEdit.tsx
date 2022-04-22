import React, { useRef } from 'react';
import { GrafanaTheme2, PanelModel } from '@grafana/data';
import { DashboardModel } from '../../../features/dashboard/state';
import Draggable from 'react-draggable';
import { useTheme2 } from '@grafana/ui/src';
import { cx, css } from '@emotion/css';
import { useClickAway } from 'react-use';

type Props = {
  onClose?: () => void;
  panel: PanelModel;
  dashboard: DashboardModel;
};

export const InlineEdit = ({ panel, dashboard, onClose }: Props) => {
  console.log('InlineEdit');
  console.log(panel);
  const theme = useTheme2();
  const bbox = document.querySelector(`[data-inlineeditpanelid="${panel.id}"]`)!.getBoundingClientRect();
  const ref = useRef<HTMLDivElement>(null);
  const styles = getStyles(theme, bbox);

  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  return (
    <Draggable handle="strong">
      <div className={cx('box', 'no-cursor', 'react-resizable', `${styles.inlineEditorContainer}`)} ref={ref}>
        <strong className="cursor">
          <div>Drag here</div>
        </strong>
        <div style={{ overflow: 'scroll' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            I have long scrollable content with a handle
            {'\n' + Array(40).fill('x').join('\n')}
          </div>
        </div>
        <span className="react-resizable-handle react-resizable-handle-se" />
      </div>
    </Draggable>
  );
};

const getStyles = (theme: GrafanaTheme2, bbox: DOMRect) => ({
  inlineEditorContainer: css`
    display: flex;
    flex-direction: column;
    position: absolute;
    top: ${bbox.y - 150}px;
    left: ${bbox.x + bbox.width + 5}px;
    background: ${theme.colors.background}; //panelBg
    box-shadow: 5px 5px 20px -5px #000000;
    width: 300px;
    height: 500px;
  `,
  rzHandle: css`
    background: ${theme.colors.secondary.main};
    transition: 0.3s background ease-in-out;
    position: relative;
    width: 200px !important;
    height: 7px !important;
    left: calc(50% - 100px) !important;
    top: -4px !important;
    cursor: grab;
    border-radius: 4px;
    &:hover {
      background: ${theme.colors.secondary.shade};
    }
  `,
});
