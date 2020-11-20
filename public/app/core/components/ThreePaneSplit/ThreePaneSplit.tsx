import React, { createRef, MutableRefObject, PureComponent } from 'react';
import SplitPane from 'react-split-pane';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

enum Pane {
  Right,
  Top,
}

interface Props {
  horizontalSplitComponents: React.ReactNode[];
  rightPaneComponent: React.ReactNode;
  uiState: { topPaneSize: number | string; rightPaneSize: number | string };
  rightPanelVisible?: boolean;
  updateUiState: (uiState: { topPaneSize?: number; rightPaneSize?: number }) => void;
}

export class ThreePaneSplit extends PureComponent<Props> {
  rafToken = createRef<number>();
  static defaultProps = {
    rightPanelVisible: true,
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
    (this.rafToken as MutableRefObject<number>).current = window.requestAnimationFrame(() => {
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
    const { horizontalSplitComponents, uiState } = this.props;
    const styles = getStyles(config.theme);
    const topPaneSize =
      uiState.topPaneSize >= 1 ? (uiState.topPaneSize as number) : (uiState.topPaneSize as number) * window.innerHeight;

    /*
      Guesstimate the height of the browser window minus
      panel toolbar and editor toolbar (~120px). This is to prevent resizing
      the preview window beyond the browser window.
     */
    const maxHeight = window.innerHeight - 120;

    return (
      <SplitPane
        split="horizontal"
        maxSize={maxHeight}
        primary="first"
        size={topPaneSize < 200 ? 200 : topPaneSize}
        pane2Style={{ minHeight: 0 }}
        resizerClassName={styles.resizerH}
        onDragStarted={this.onDragStarted}
        onDragFinished={size => this.onDragFinished(Pane.Top, size)}
      >
        {horizontalSplitComponents}
      </SplitPane>
    );
  }

  render() {
    const { rightPanelVisible, rightPaneComponent, uiState } = this.props;
    // Limit options pane width to 90% of screen.
    const maxWidth = window.innerWidth * 0.9;
    const styles = getStyles(config.theme);

    // Need to handle when width is relative. ie a percentage of the viewport
    const rightPaneSize =
      uiState.rightPaneSize <= 1
        ? (uiState.rightPaneSize as number) * window.innerWidth
        : (uiState.rightPaneSize as number);

    if (!rightPanelVisible) {
      return this.renderHorizontalSplit();
    }

    return (
      <SplitPane
        split="vertical"
        maxSize={maxWidth}
        size={rightPaneSize >= 300 ? rightPaneSize : 300}
        primary="second"
        resizerClassName={styles.resizerV}
        onDragStarted={() => (document.body.style.cursor = 'col-resize')}
        onDragFinished={size => this.onDragFinished(Pane.Right, size)}
      >
        {this.renderHorizontalSplit()}
        {rightPaneComponent}
      </SplitPane>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const handleColor = theme.palette.blue95;
  const paneSpacing = theme.spacing.md;

  const resizer = css`
    font-style: italic;
    background: transparent;
    border-top: 0;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-color: transparent;
    border-style: solid;
    transition: 0.2s border-color ease-in-out;

    &:hover {
      border-color: ${handleColor};
    }
  `;

  return {
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
        width: ${paneSpacing};
        border-right-width: 1px;
        margin-top: 18px;
      `
    ),
    resizerH: cx(
      resizer,
      css`
        height: ${paneSpacing};
        cursor: row-resize;
        position: relative;
        top: 0px;
        z-index: 1;
        border-top-width: 1px;
        margin-left: ${paneSpacing};
      `
    ),
  };
});
