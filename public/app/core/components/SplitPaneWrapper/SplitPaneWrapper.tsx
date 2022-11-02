import { css, cx } from '@emotion/css';
import React, { createRef, MutableRefObject, PureComponent, ReactNode } from 'react';
import SplitPane from 'react-split-pane';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';

enum Pane {
  Right,
  Top,
}

interface Props {
  leftPaneComponents: ReactNode[] | ReactNode;
  rightPaneComponents: ReactNode;
  uiState: { topPaneSize: number; rightPaneSize: number };
  rightPaneVisible?: boolean;
  updateUiState: (uiState: { topPaneSize?: number; rightPaneSize?: number }) => void;
}

export class SplitPaneWrapper extends PureComponent<Props> {
  rafToken: MutableRefObject<number | null> = createRef();
  static defaultProps = {
    rightPaneVisible: true,
  };

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

  onDragFinished = (pane: Pane, size?: number) => {
    document.body.style.cursor = 'auto';

    // When the drag handle is just clicked size is undefined
    if (!size) {
      return;
    }

    const { updateUiState } = this.props;
    if (pane === Pane.Top) {
      updateUiState({
        topPaneSize: size / window.innerHeight,
      });
    } else {
      updateUiState({
        rightPaneSize: size / window.innerWidth,
      });
    }
  };

  onDragStarted = () => {
    document.body.style.cursor = 'row-resize';
  };

  renderHorizontalSplit() {
    const { leftPaneComponents, uiState } = this.props;
    const styles = getStyles(config.theme2);
    const topPaneSize = uiState.topPaneSize >= 1 ? uiState.topPaneSize : uiState.topPaneSize * window.innerHeight;

    /*
      Guesstimate the height of the browser window minus
      panel toolbar and editor toolbar (~120px). This is to prevent resizing
      the preview window beyond the browser window.
     */

    if (Array.isArray(leftPaneComponents)) {
      return (
        <SplitPane
          split="horizontal"
          maxSize={-200}
          primary="first"
          size={topPaneSize}
          pane2Style={{ minHeight: 0 }}
          resizerClassName={styles.resizerH}
          onDragStarted={this.onDragStarted}
          onDragFinished={(size) => this.onDragFinished(Pane.Top, size)}
        >
          {leftPaneComponents}
        </SplitPane>
      );
    }

    return <div className={styles.singleLeftPane}>{leftPaneComponents}</div>;
  }

  render() {
    const { rightPaneVisible, rightPaneComponents, uiState } = this.props;
    // Limit options pane width to 90% of screen.
    const styles = getStyles(config.theme2);

    // Need to handle when width is relative. ie a percentage of the viewport
    const rightPaneSize =
      uiState.rightPaneSize <= 1 ? uiState.rightPaneSize * window.innerWidth : uiState.rightPaneSize;

    if (!rightPaneVisible) {
      return this.renderHorizontalSplit();
    }

    return (
      <SplitPane
        split="vertical"
        maxSize={-300}
        size={rightPaneSize}
        primary="second"
        resizerClassName={styles.resizerV}
        onDragStarted={() => (document.body.style.cursor = 'col-resize')}
        onDragFinished={(size) => this.onDragFinished(Pane.Right, size)}
      >
        {this.renderHorizontalSplit()}
        {rightPaneComponents}
      </SplitPane>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  const handleColor = theme.v1.palette.blue95;
  const paneSpacing = theme.spacing(2);

  const resizer = css`
    position: relative;

    &::before {
      content: '';
      position: absolute;
      transition: 0.2s border-color ease-in-out;
    }

    &::after {
      background: ${theme.components.panel.borderColor};
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      transition: 0.2s background ease-in-out;
      transform: translate(-50%, -50%);
      border-radius: 4px;
    }

    &:hover {
      &::before {
        border-color: ${handleColor};
      }

      &::after {
        background: ${handleColor};
      }
    }
  `;

  return {
    singleLeftPane: css`
      height: 100%;
      position: absolute;
      overflow: hidden;
      width: 100%;
    `,
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
        width: ${paneSpacing};

        &::before {
          border-right: 1px solid transparent;
          height: 100%;
          left: 50%;
          transform: translateX(-50%);
        }

        &::after {
          height: 200px;
          width: 4px;
        }
      `
    ),
    resizerH: cx(
      resizer,
      css`
        height: ${paneSpacing};
        cursor: row-resize;
        margin-left: ${paneSpacing};

        &::before {
          border-top: 1px solid transparent;
          top: 50%;
          transform: translateY(-50%);
          width: 100%;
        }

        &::after {
          height: 4px;
          width: 200px;
        }
      `
    ),
  };
};
