import React, { PureComponent } from 'react';
import { toDuration } from '@grafana/data';

const INTERVAL = 150;

export interface Props {
  time?: number;
  // Use this to reset the timer. Any value is allowed just need to be !== from the previous.
  // Keep in mind things like [] !== [] or {} !== {}.
  resetKey?: any;
  className?: string;
  humanize?: boolean;
}

export interface State {
  elapsed: number;
}

/**
 * Shows an incremental time ticker of elapsed time from some event.
 */
export default class ElapsedTime extends PureComponent<Props, State> {
  offset: number;
  timer: number;

  state = {
    elapsed: 0,
  };

  start() {
    this.offset = Date.now();
    this.timer = window.setInterval(this.tick, INTERVAL);
  }

  tick = () => {
    const jetzt = Date.now();
    const elapsed = jetzt - this.offset;
    this.setState({ elapsed });
  };

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.time) {
      clearInterval(this.timer);
    } else if (this.props.time) {
      this.start();
    }

    if (nextProps.resetKey !== this.props.resetKey) {
      clearInterval(this.timer);
      this.start();
    }
  }

  componentDidMount() {
    this.start();
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  render() {
    const { elapsed } = this.state;
    const { className, time, humanize } = this.props;
    const value = (time || elapsed) / 1000;
    let displayValue = `${value.toFixed(1)}s`;
    if (humanize) {
      const duration = toDuration(elapsed);
      const hours = duration.hours();
      const minutes = duration.minutes();
      const seconds = duration.seconds();
      displayValue = hours ? `${hours}h ${minutes}m ${seconds}s` : minutes ? ` ${minutes}m ${seconds}s` : `${seconds}s`;
    }
    return <span className={`elapsed-time ${className}`}>{displayValue}</span>;
  }
}
