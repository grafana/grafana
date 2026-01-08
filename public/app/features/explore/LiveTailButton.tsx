import { css } from '@emotion/css';
import { useRef } from 'react';
import { CSSTransition } from 'react-transition-group';

import { t } from '@grafana/i18n';
import { ButtonGroup, ToolbarButton } from '@grafana/ui';

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
  const transitionRef = useRef(null);

  const { start, pause, resume, isLive, isPaused, stop, splitted } = props;
  const buttonVariant = isLive && !isPaused ? 'active' : 'canvas';
  const onClickMain = isLive ? (isPaused ? resume : pause) : start;

  return (
    <ButtonGroup>
      <ToolbarButton
        iconOnly={splitted}
        variant={buttonVariant}
        icon={!isLive || isPaused ? 'play' : 'pause'}
        onClick={onClickMain}
        tooltip={
          !isLive || isPaused
            ? t('explore.live-tail-button.start-live-stream-your-logs', 'Start live stream your logs')
            : t('explore.live-tail-button.pause-the-live-stream', 'Pause the live stream')
        }
      >
        {isLive && isPaused
          ? t('explore.live-tail-button.paused', 'Paused')
          : t('explore.live-tail-button.live', 'Live')}
      </ToolbarButton>

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
        nodeRef={transitionRef}
      >
        <ToolbarButton
          tooltip={t('explore.live-tail-button.stop-and-exit-the-live-stream', 'Stop and exit the live stream')}
          ref={transitionRef}
          variant={buttonVariant}
          onClick={stop}
          icon="square-shape"
        />
      </CSSTransition>
    </ButtonGroup>
  );
}

const styles = {
  stopButtonEnter: css({
    label: 'stopButtonEnter',
    width: 0,
    opacity: 0,
    overflow: 'hidden',
  }),
  stopButtonEnterActive: css({
    label: 'stopButtonEnterActive',
    opacity: 1,
    width: '32px',
  }),
  stopButtonExit: css({
    label: 'stopButtonExit',
    width: '32px',
    opacity: 1,
    overflow: 'hidden',
  }),
  stopButtonExitActive: css({
    label: 'stopButtonExitActive',
    opacity: 0,
    width: 0,
  }),
};
