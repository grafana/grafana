import React from 'react';
import { TimeRange } from '@grafana/data';

// enableLiveTimeRange: boolean;
// width?: number; // estimate from pixels?

interface WithTimeRangeProps {
  timeRange: TimeRange;
  width?: number;
}

interface State {
  intervalMs: number;
  timeRange: TimeRange;
}

export const withLiveTimeRange = <P extends WithTimeRangeProps>(Component: React.ComponentType<P>) =>
  class WithLiveTimeRange extends React.Component<P, State> {
    constructor(props: P) {
      super(props);
      this.state = {
        intervalMs: 0,
        timeRange: props.timeRange,
      };
    }

    componentDidMount() {
      this.checkTimeRange();
    }

    componentDidUpdate(oldProps: WithTimeRangeProps) {
      if (this.props.timeRange !== oldProps.timeRange) {
        this.checkTimeRange();
      }
    }

    checkTimeRange() {
      console.log('TODO, check timerange');

      //  let timeSeriesComp = timeRange?.raw?.to === 'now' ?  LiveTimeSeries: TimeSeries;
    }

    render() {
      const { ...props } = this.props;
      const { timeRange } = this.state;
      return <Component {...(props as P)} timeRange={timeRange} />;
    }
  };
