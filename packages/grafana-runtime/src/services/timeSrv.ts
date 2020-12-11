import { RawTimeRange, TimeRange } from '@grafana/data';

/**
 * TimeSrv allows to get and control dashboard time range.
 *
 * @public
 */
export interface TimeSrv {
  /**
   * Get a current time range or default one.
   */
  timeRange(): TimeRange;

  /**
   * Get a raw time range for current URL.
   */
  timeRangeForUrl(): RawTimeRange;
}

let singletonInstance: TimeSrv;

/**
 * Used during startup by Grafana to set the DataSourceSrv so it is available
 * via the {@link getTimeSrv} to the rest of the application.
 *
 * @internal
 */
export const setTimeSrv = (instance: TimeSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link TimeSrv} that allows to get and control dashboard time range.
 *
 * @public
 */
export const getTimeSrv = (): TimeSrv => singletonInstance;
