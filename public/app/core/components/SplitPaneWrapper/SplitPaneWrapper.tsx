import { css, cx } from '@emotion/css';
import React, { createRef, MutableRefObject, PureComponent } from 'react';
import SplitPane, { Split } from 'react-split-pane';

import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles } from '@grafana/ui';
import { config } from 'app/core/config';

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

export class SplitPaneWrapper extends PureComponent<React.PropsWithChildren<Props>> {
  //requestAnimationFrame reference
  rafToken: MutableRefObject<number | null> = createRef();

  componentDidMount() {
    window.addEventListener('resize', this.updateSplitPaneSize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateSplitPaneSize);
  }

  updateSplitPaneSize = () => {
    if (this.rafToken.current !== undefined) {
      window.cancelAnimationFrame(this.rafToken.current!);
    }
    this.rafToken.current = window.requestAnimationFrame(() => {
      this.forceUpdate();
    });
  };

  onDragFinished = (size?: number) => {
    document.body.style.cursor = 'auto';

    if (this.props.onDragFinished && size !== undefined) {
      this.props.onDragFinished(size);
    }
  };

  onDragStarted = () => {
    document.body.style.cursor = this.props.splitOrientation === 'horizontal' ? 'row-resize' : 'col-resize';
  };

  render() {
    const {
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
    } = this.props;

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
      paneSize <= 1
        ? paneSize * (splitOrientation === 'horizontal' ? window.innerHeight : window.innerWidth)
        : paneSize;

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
        onDragStarted={() => this.onDragStarted()}
        onDragFinished={(size) => this.onDragFinished(size)}
        style={parentStyle}
        paneStyle={paneStyle}
        pane2Style={secondaryPaneStyle}
      >
        {childrenFragments}
      </SplitPane>
    );
  }
}

const getStyles = (theme: GrafanaTheme2, hasSplit: boolean) => {
  return {
    resizer: css({
      display: hasSplit ? 'block' : 'none',
    }),
  };
};
