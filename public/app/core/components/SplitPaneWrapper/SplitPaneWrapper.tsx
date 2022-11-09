import { css, cx } from '@emotion/css';
import React, { createRef, MutableRefObject, PureComponent } from 'react';
import SplitPane, { Split } from 'react-split-pane';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';

interface Props {
  splitOrientation?: Split;
  paneSize: number;
  splitVisible?: boolean;
  maxSize?: number;
  primary?: 'first' | 'second';
  onDragFinished?: (size?: number) => void;
  secondaryPaneStyle?: React.CSSProperties;
}

export class SplitPaneWrapper extends PureComponent<Props> {
  refToken: MutableRefObject<number | null> = createRef();

  componentDidMount() {
    window.addEventListener('resize', this.updateSplitPaneSize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateSplitPaneSize);
  }

  updateSplitPaneSize = () => {
    if (this.refToken.current !== undefined) {
      window.cancelAnimationFrame(this.refToken.current!);
    }
    this.refToken.current = window.requestAnimationFrame(() => {
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
    const { paneSize, splitOrientation, maxSize, primary, secondaryPaneStyle, splitVisible = true } = this.props;

    // Limit options pane width to 90% of screen.
    const styles = getStyles(config.theme2, splitVisible);

    // Need to handle when width is relative. ie a percentage of the viewport
    const paneSizePx =
      paneSize <= 1
        ? paneSize * (splitOrientation === 'horizontal' ? window.innerHeight : window.innerWidth)
        : paneSize;

    return (
      <SplitPane
        split={splitOrientation}
        maxSize={maxSize}
        size={splitVisible ? paneSizePx : 0}
        primary={splitVisible ? primary : 'second'}
        resizerClassName={splitOrientation === 'horizontal' ? styles.resizerH : styles.resizerV}
        onDragStarted={() => this.onDragStarted()}
        onDragFinished={(size) => this.onDragFinished(size)}
        pane2Style={secondaryPaneStyle}
      >
        {this.props.children}
      </SplitPane>
    );
  }
}

const getStyles = (theme: GrafanaTheme2, hasSplit: boolean) => {
  const handleColor = theme.v1.palette.blue95;
  const paneSpacing = theme.spacing(2);

  const resizer = css`
    position: relative;
    display: ${hasSplit ? 'block' : 'none'};

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
