import React from 'react';
import { dateMath, TimeRange } from '@grafana/data';
import { perf } from 'app/features/live/perf';

interface WithTimeRangeProps {
  timeRange: TimeRange;
  width?: number;
}

interface State {
  timeRange: TimeRange;
}

export const withLiveTimeRange = <P extends WithTimeRangeProps>(Component: React.ComponentType<P>) =>
  class WithLiveTimeRange extends React.Component<P, State> {
    timeoutID?: any;
    interval = 1000;
    rawFrom = '';
    last = -1;

    constructor(props: P) {
      super(props);
      this.state = {
        timeRange: props.timeRange,
      };
    }

    componentWillUnmount() {
      clearTimeout(this.timeoutID);
    }

    componentDidMount() {
      this.propsTimeRangeChanged();
    }

    componentDidUpdate(oldProps: WithTimeRangeProps) {
      if (this.props.timeRange !== oldProps.timeRange) {
        this.propsTimeRangeChanged();
      }
    }

    // Avoid updates if the perf budget is used up
    tick = () => {
      const raw = this.props.timeRange?.raw;
      if (raw?.to === 'now') {
        const elapsed = perf.last - this.last;
        if (elapsed > 1000 || perf.ok) {
          this.setState({
            timeRange: {
              raw,
              from: dateMath.parse(raw.from, false)!,
              to: dateMath.parse(raw.to, true)!,
            },
          });
          this.last = perf.last;
        }
        if (this.interval > 0) {
          this.timeoutID = setTimeout(this.tick, this.interval);
        }
      }
    };

    propsTimeRangeChanged() {
      const { timeRange, width } = this.props;
      clearTimeout(this.timeoutID);

      const { raw } = timeRange;
      if (raw?.to === 'now') {
        if (raw.from !== this.rawFrom) {
          this.interval = calculateInterval(timeRange, width);
          this.rawFrom = `${raw.from}`;
        }
        if (this.interval > 0) {
          this.timeoutID = setTimeout(this.tick, this.interval);
        }
      }
      this.setState({ timeRange });
    }

    render() {
      const { timeRange, ...props } = this.props;
      const useTimeRage = this.state.timeRange;
      return <Component {...(props as P)} timeRange={useTimeRage} />;
    }
  };

// Hardcode to 10hz for now
export function calculateInterval(timeRange: TimeRange, width?: number) {
  const millis = timeRange.to.valueOf() - timeRange.from.valueOf();
  const millisPerPixel = millis / (width ?? 1000);
  console.log('MILLIS per pixel', millisPerPixel, millis, timeRange);
  return 500; // 10hz
}
