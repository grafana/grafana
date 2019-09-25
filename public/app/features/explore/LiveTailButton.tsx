import React from 'react';
import classNames from 'classnames';
import { css } from 'emotion';
import memoizeOne from 'memoize-one';
import tinycolor from 'tinycolor2';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme, GrafanaThemeType, useTheme } from '@grafana/ui';

const getStyles = memoizeOne((theme: GrafanaTheme) => {
  const orange = theme.type === GrafanaThemeType.Dark ? '#FF780A' : '#ED5700';
  const orangeLighter = tinycolor(orange)
    .lighten(10)
    .toString();
  const pulseTextColor = tinycolor(orange)
    .desaturate(90)
    .toString();

  return {
    noRightBorderStyle: css`
      label: noRightBorderStyle;
      border-right: 0;
    `,
    liveButton: css`
      label: liveButton;
      transition: background-color 1s, border-color 1s, color 1s;
      margin: 0;
    `,
    isLive: css`
      label: isLive;
      border-color: ${orange};
      color: ${orange};
      background: transparent;
      &:focus {
        border-color: ${orange};
        color: ${orange};
      }
      &:active,
      &:hover {
        border-color: ${orangeLighter};
        color: ${orangeLighter};
      }
    `,
    isPaused: css`
      label: isPaused;
      border-color: ${orange};
      background: transparent;
      animation: pulse 3s ease-out 0s infinite normal forwards;
      &:focus {
        border-color: ${orange};
      }
      &:active,
      &:hover {
        border-color: ${orangeLighter};
      }
      @keyframes pulse {
        0% {
          color: ${pulseTextColor};
        }
        50% {
          color: ${orange};
        }
        100% {
          color: ${pulseTextColor};
        }
      }
    `,
    stopButtonEnter: css`
      label: stopButtonEnter;
      width: 0;
      opacity: 0;
      overflow: hidden;
    `,
    stopButtonEnterActive: css`
      label: stopButtonEnterActive;
      opacity: 1;
      width: 32px;
      transition: opacity 500ms ease-in 50ms, width 500ms ease-in 50ms;
    `,
    stopButtonExit: css`
      label: stopButtonExit;
      width: 32px;
      opacity: 1;
      overflow: hidden;
    `,
    stopButtonExitActive: css`
      label: stopButtonExitActive;
      opacity: 0;
      width: 0;
      transition: opacity 500ms ease-in 50ms, width 500ms ease-in 50ms;
    `,
  };
});

type LiveTailButtonProps = {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isLive: boolean;
  isPaused: boolean;
};
export function LiveTailButton(props: LiveTailButtonProps) {
  const { start, pause, resume, isLive, isPaused, stop } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  const onClickMain = isLive ? (isPaused ? resume : pause) : start;

  return (
    <>
      <button
        className={classNames('btn navbar-button', styles.liveButton, {
          [`btn--radius-right-0 ${styles.noRightBorderStyle}`]: isLive,
          [styles.isLive]: isLive && !isPaused,
          [styles.isPaused]: isLive && isPaused,
        })}
        onClick={onClickMain}
      >
        <i className={classNames('fa', isPaused || !isLive ? 'fa-play' : 'fa-pause')} />
        &nbsp; Live tailing
      </button>
      <CSSTransition
        mountOnEnter={true}
        unmountOnExit={true}
        timeout={500}
        in={isLive}
        classNames={{
          enter: styles.stopButtonEnter,
          enterActive: styles.stopButtonEnterActive,
          exit: styles.stopButtonExit,
          exitActive: styles.stopButtonExitActive,
        }}
      >
        <div>
          <button className={`btn navbar-button navbar-button--attached ${styles.isLive}`} onClick={stop}>
            <i className={'fa fa-stop'} />
          </button>
        </div>
      </CSSTransition>
    </>
  );
}
