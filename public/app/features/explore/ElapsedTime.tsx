import React, { PureComponent } from 'react';

const INTERVAL = 150;

export default class ElapsedTime extends PureComponent<any, any> {
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

  componentWillReceiveProps(nextProps) {
    if (nextProps.time) {
      clearInterval(this.timer);
    } else if (this.props.time) {
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
    const { className, time } = this.props;
    const value = (time || elapsed) / 1000;
    return <span className={`elapsed-time ${className}`}>{value.toFixed(1)}s</span>;
  }
}
