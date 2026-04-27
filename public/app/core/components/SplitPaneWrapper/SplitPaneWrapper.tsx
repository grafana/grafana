import { css, cx } from '@emotion/css';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import SplitPane, { type Split } from 'react-split-pane';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { config } from '@grafana/runtime';
import { getDragStyles } from '@grafana/ui';

interface Props {
  splitOrientation?: Split;
  paneSize: number;
  splitVisible?: boolean;
  minSize?: number;
  maxSize?: number;
  primary?: 'first' | 'second';
  onDragFinished?: (size?: number) => void;
  parentStyle?: React.CSSProperties;
  paneStyle?: React.CSSProperties;
  secondaryPaneStyle?: React.CSSProperties;
}

export const SplitPaneWrapper = memo(function SplitPaneWrapper({
  children,
  paneSize,
  splitOrientation,
  maxSize,
  minSize,
  primary,
  parentStyle,
  paneStyle,
  secondaryPaneStyle,
  splitVisible = true,
  onDragFinished,
}: React.PropsWithChildren<Props>) {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const rafToken = useRef<number | null>(null);

  useEffect(() => {
    const updateSplitPaneSize = () => {
      if (rafToken.current !== null) {
        window.cancelAnimationFrame(rafToken.current);
      }
      rafToken.current = window.requestAnimationFrame(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      });
    };

    window.addEventListener('resize', updateSplitPaneSize);
    return () => {
      window.removeEventListener('resize', updateSplitPaneSize);
    };
  }, []);

  const handleDragFinished = useCallback(
    (size?: number) => {
      document.body.style.cursor = 'auto';
      if (onDragFinished && size !== undefined) {
        onDragFinished(size);
      }
    },
    [onDragFinished]
  );

  const handleDragStarted = useCallback(() => {
    document.body.style.cursor = splitOrientation === 'horizontal' ? 'row-resize' : 'col-resize';
  }, [splitOrientation]);

  let childrenArr = [];
  if (Array.isArray(children)) {
    childrenArr = children;
  } else {
    childrenArr.push(children);
  }

  // Limit options pane width to 90% of screen.
  const styles = getStyles(config.theme2, splitVisible);
  const dragStyles = getDragStyles(config.theme2);

  // Need to handle when width is relative. ie a percentage of the viewport
  const paneSizePx =
    paneSize <= 1 ? paneSize * (splitOrientation === 'horizontal' ? dimensions.height : dimensions.width) : paneSize;

  // the react split pane library always wants 2 children. This logic ensures that happens, even if one child is passed in
  const childrenFragments = [
    <React.Fragment key="leftPane">{childrenArr[0]}</React.Fragment>,
    <React.Fragment key="rightPane">{childrenArr[1] || undefined}</React.Fragment>,
  ];

  return (
    <SplitPane
      split={splitOrientation}
      minSize={minSize}
      maxSize={maxSize}
      size={splitVisible ? paneSizePx : 0}
      primary={splitVisible ? primary : 'second'}
      resizerClassName={cx(
        styles.resizer,
        splitOrientation === 'horizontal' ? dragStyles.dragHandleHorizontal : dragStyles.dragHandleVertical
      )}
      onDragStarted={() => handleDragStarted()}
      onDragFinished={(size) => handleDragFinished(size)}
      style={parentStyle}
      paneStyle={paneStyle}
      pane2Style={secondaryPaneStyle}
    >
      {childrenFragments}
    </SplitPane>
  );
});

const getStyles = (theme: GrafanaTheme2, hasSplit: boolean) => {
  return {
    resizer: css({
      display: hasSplit ? 'block' : 'none',
    }),
  };
};
