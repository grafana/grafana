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

const getResizerStyles = (hasSplit: boolean) => (theme: GrafanaTheme2) =>
  css`
    position: relative;
    display: ${hasSplit ? 'block' : 'none'};

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

  // create two elements for library, even if only one exists (one will be hidden)
  const hasSplit = children.filter(Boolean).length === 2;

  const existingChildren = [
    <React.Fragment key="leftPane">{children[0]}</React.Fragment>,
    <React.Fragment key="rightPane">{hasSplit && children[1]}</React.Fragment>,
  ];

  return (
    <SplitPane
      split="vertical"
      size={rightPaneSize}
      primary="second"
      minSize={minSize}
      maxSize={width - minSize}
      resizerClassName={useStyles2(getResizerStyles(hasSplit))}
      paneStyle={{ overflow: 'auto', display: 'flex', flexDirection: 'column', overflowY: 'scroll' }}
      onDragStarted={onDragStarted}
      onDragFinished={(size: number) => onDragFinished(size, onResize)}
    >
      {existingChildren}
    </SplitPane>
  );
};
