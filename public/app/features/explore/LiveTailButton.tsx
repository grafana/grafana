import React from 'react';
import classNames from 'classnames';
import { css } from 'emotion';
import memoizeOne from 'memoize-one';
import { GrafanaTheme, GrafanaThemeType, useTheme } from '@grafana/ui';
import tinycolor from 'tinycolor2';

const orangeDark = '#FF780A';
const orangeDarkLighter = tinycolor(orangeDark)
  .lighten(10)
  .toString();
const orangeLight = '#ED5700';
const orangeLightLighter = tinycolor(orangeLight)
  .lighten(10)
  .toString();

const getStyles = memoizeOne((theme: GrafanaTheme) => {
  const orange = theme.type === GrafanaThemeType.Dark ? orangeDark : orangeLight;
  const orangeLighter = theme.type === GrafanaThemeType.Dark ? orangeDarkLighter : orangeLightLighter;
  const textColor = theme.type === GrafanaThemeType.Dark ? theme.colors.white : theme.colors.black;

  return {
    noRightBorderStyle: css`
      label: noRightBorderStyle;
      border-right: 0;
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
      animation: pulse 2s ease-out 0s infinite normal forwards;
      &:focus {
        border-color: ${orange};
      }
      &:active,
      &:hover {
        border-color: ${orangeLighter};
      }
      @keyframes pulse {
        0% {
          color: ${textColor};
        }
        50% {
          color: ${orange};
        }
        100% {
          color: ${textColor};
        }
      }
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
    <div className="explore-toolbar-content-item">
      <button
        className={classNames('btn navbar-button', {
          [`btn--radius-right-0 ${styles.noRightBorderStyle}`]: isLive,
          [styles.isLive]: isLive && !isPaused,
          [styles.isPaused]: isLive && isPaused,
        })}
        onClick={onClickMain}
      >
        <i className={classNames('fa', isPaused || !isLive ? 'fa-play' : 'fa-pause')} />
        &nbsp; Live tailing
      </button>
      {isLive && (
        <button className={`btn navbar-button navbar-button--attached ${styles.isLive}`} onClick={stop}>
          <i className={'fa fa-stop'} />
        </button>
      )}
    </div>
  );
}
