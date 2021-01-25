import React from 'react';
import tinycolor from 'tinycolor2';
import { css } from 'emotion';
import { CSSTransition } from 'react-transition-group';
import { useTheme, Tooltip, stylesFactory, selectThemeVariant, ButtonGroup, ToolbarButton } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.palette.gray5, dark: theme.palette.dark1 }, theme.type);
  const orangeLighter = tinycolor(theme.palette.orangeDark).lighten(10).toString();
  const pulseTextColor = tinycolor(theme.palette.orangeDark).desaturate(90).toString();

  return {
    isLive: css`
      label: isLive;
      border-color: ${theme.palette.orangeDark};
      color: ${theme.palette.orangeDark};
      background: transparent;
      &:focus {
        background: transparent;
        border-color: ${theme.palette.orangeDark};
        color: ${theme.palette.orangeDark};
      }
      &:hover {
        background-color: ${bgColor};
      }
      &:active,
      &:hover {
        border-color: ${orangeLighter};
        color: ${orangeLighter};
      }
    `,
    isPaused: css`
      label: isPaused;
      border-color: ${theme.palette.orangeDark};
      background: transparent;
      animation: pulse 3s ease-out 0s infinite normal forwards;
      &:focus {
        background: transparent;
        border-color: ${theme.palette.orangeDark};
      }
      &:hover {
        background-color: ${bgColor};
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
          color: ${theme.palette.orangeDark};
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
    `,
  };
});

type LiveTailButtonProps = {
  splitted: boolean;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isLive: boolean;
  isPaused: boolean;
};
export function LiveTailButton(props: LiveTailButtonProps) {
  const { start, pause, resume, isLive, isPaused, stop, splitted } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const buttonVariant = isLive && !isPaused ? 'active' : 'default';
  const onClickMain = isLive ? (isPaused ? resume : pause) : start;

  return (
    <ButtonGroup>
      <Tooltip
        content={isLive && !isPaused ? <>Pause the live stream</> : <>Start live stream your logs</>}
        placement="bottom"
      >
        <ToolbarButton
          iconOnly={splitted}
          variant={buttonVariant}
          icon={!isLive || isPaused ? 'play' : 'pause'}
          onClick={onClickMain}
        >
          {isLive && isPaused ? 'Paused' : 'Live'}
        </ToolbarButton>
      </Tooltip>

      <CSSTransition
        mountOnEnter={true}
        unmountOnExit={true}
        timeout={100}
        in={isLive}
        classNames={{
          enter: styles.stopButtonEnter,
          enterActive: styles.stopButtonEnterActive,
          exit: styles.stopButtonExit,
          exitActive: styles.stopButtonExitActive,
        }}
      >
        <Tooltip content={<>Stop and exit the live stream</>} placement="bottom">
          <ToolbarButton variant={buttonVariant} onClick={stop} icon="square-shape" />
        </Tooltip>
      </CSSTransition>
    </ButtonGroup>
  );
}
