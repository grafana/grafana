import React from 'react';
import classNames from 'classnames';

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

  const onClickMain = isLive ? (isPaused ? resume : pause) : start;

  return (
    <div className="explore-toolbar-content-item">
      <button className="btn navbar-button" onClick={onClickMain}>
        <i className={classNames('fa', isPaused || !isLive ? 'fa-play' : 'fa-pause')} />
        &nbsp; Live tailing
      </button>
      {isLive && (
        <button className="btn navbar-button" onClick={stop}>
          <i className={'fa fa-stop'} />
        </button>
      )}
    </div>
  );
}
