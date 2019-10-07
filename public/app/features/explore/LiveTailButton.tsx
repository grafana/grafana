import React from 'react';
import classNames from 'classnames';
import { css } from 'emotion';
import memoizeOne from 'memoize-one';
import tinycolor from 'tinycolor2';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme, useTheme, Tooltip } from '@grafana/ui';

const getStyles = memoizeOne((theme: GrafanaTheme) => {
  const orangeLighter = tinycolor(theme.colors.orangeDark)
    .lighten(10)
    .toString();
  const pulseTextColor = tinycolor(theme.colors.orangeDark)
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
      border-color: ${theme.colors.orangeDark};
      color: ${theme.colors.orangeDark};
      background: transparent;
      &:focus {
        border-color: ${theme.colors.orangeDark};
        color: ${theme.colors.orangeDark};
      }
      &:active,
      &:hover {
        border-color: ${orangeLighter};
        color: ${orangeLighter};
      }
    `,
    isPaused: css`
      label: isPaused;
      border-color: ${theme.colors.orangeDark};
      background: transparent;
      animation: pulse 3s ease-out 0s infinite normal forwards;
      &:focus {
        border-color: ${theme.colors.orangeDark};
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
          color: ${theme.colors.orangeDark};
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

const defaultLiveTooltip = () => {
  return <>Live</>;
};

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
      <Tooltip content={defaultLiveTooltip} placement="bottom">
        <button
          className={classNames('btn navbar-button', styles.liveButton, {
            [`btn--radius-right-0 ${styles.noRightBorderStyle}`]: isLive,
            [styles.isLive]: isLive && !isPaused,
            [styles.isPaused]: isLive && isPaused,
          })}
          onClick={onClickMain}
        >
          <i className={classNames('fa', isPaused || !isLive ? 'fa-play' : 'fa-pause')} />
          <span>&nbsp; Live</span>
        </button>
      </Tooltip>
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
