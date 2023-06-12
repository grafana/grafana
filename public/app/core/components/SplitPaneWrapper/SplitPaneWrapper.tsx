import { css, cx } from '@emotion/css';
import React, { createRef, MutableRefObject, PureComponent } from 'react';
import SplitPane, { Split } from 'react-split-pane';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';

interface Props {
  splitOrientation?: Split;
  paneSize: number;
  splitVisible?: boolean;
  minSize?: number;
  maxSize?: number;
  primary?: 'first' | 'second';
  onDragFinished?: (size?: number) => void;
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
        resizerClassName={splitOrientation === 'horizontal' ? styles.resizerH : styles.resizerV}
        onDragStarted={() => this.onDragStarted()}
        onDragFinished={(size) => this.onDragFinished(size)}
        paneStyle={paneStyle}
        pane2Style={secondaryPaneStyle}
      >
        {childrenFragments}
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
      border-radius: ${theme.shape.radius.default};
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
