import { css } from '@emotion/css';
import { useViewportSize } from '@react-aria/utils';
import React, { ReactNode } from 'react';
import SplitPane from 'react-split-pane';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  children: [ReactNode, ReactNode];
  uiState: { rightPaneSize: number };
  minSize?: number;
  onResize?: (size: number) => void;
}

const onDragFinished = (size: number, onResize?: (size: number) => void) => {
  document.body.style.cursor = 'auto';
  onResize?.(size);
};

const onDragStarted = () => {
  document.body.style.cursor = 'row-resize';
};

const getResizerStyles = (theme: GrafanaTheme2) => css`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    transition: 0.2s border-color ease-in-out;
    border-right: 1px solid ${theme.colors.border.weak};
    height: 100%;
    left: 50%;
    transform: translateX(-50%);
  }

  &::after {
    background: ${theme.colors.border.weak};
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transition: 0.2s background ease-in-out;
    transform: translate(-50%, -50%);
    border-radius: 4px;
    height: 200px;
    width: 4px;
  }

  &:hover {
    &::before {
      border-color: ${theme.colors.primary.main};
    }

    &::after {
      background: ${theme.colors.primary.main};
    }
  }

  cursor: col-resize;
  width: ${theme.spacing(2)};
`;

export const SplitView = ({ uiState: { rightPaneSize }, children, minSize = 200, onResize }: Props) => {
  const { width } = useViewportSize();

  //console.log('splitview render', children);

  return (
    <SplitPane
      split="vertical"
      size={rightPaneSize}
      primary="second"
      minSize={minSize}
      maxSize={width - minSize}
      resizerClassName={useStyles2(getResizerStyles)}
      paneStyle={{ overflow: 'scroll' }}
      onDragStarted={onDragStarted}
      onDragFinished={(size: number) => onDragFinished(size, onResize)}
    >
      {children}
    </SplitPane>
  );
};
