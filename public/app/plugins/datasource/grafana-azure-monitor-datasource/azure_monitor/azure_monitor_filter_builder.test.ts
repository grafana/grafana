jest.mock('app/core/utils/kbn', () => {
  return {
    interval_to_ms: interval => {
      if (interval.substring(interval.length - 1) === 's') {
        return interval.substring(0, interval.length - 1) * 1000;
      }

      if (interval.substring(interval.length - 1) === 'm') {
        return interval.substring(0, interval.length - 1) * 1000 * 60;
      }

      if (interval.substring(interval.length - 1) === 'd') {
        return interval.substring(0, interval.length - 1) * 1000 * 60 * 24;
      }

      return undefined;
    },
  };
});

import AzureMonitorFilterBuilder from './azure_monitor_filter_builder';
import moment from 'moment';

describe('AzureMonitorFilterBuilder', () => {
  let builder: AzureMonitorFilterBuilder;

  const timefilter = 'timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z';
  const metricFilter = 'metricnames=Percentage CPU';

  beforeEach(() => {
    builder = new AzureMonitorFilterBuilder(
      'Percentage CPU',
      moment.utc('2017-08-22 06:00'),
      moment.utc('2017-08-22 07:00'),
      'PT1H',
      '3m'
    );
  });

  describe('with a metric name and auto time grain of 3 minutes', () => {
    beforeEach(() => {
      builder.timeGrain = 'auto';
    });

    it('should always add datetime filtering and a time grain rounded to the closest allowed value to the filter', () => {
      const filter = timefilter + '&interval=PT5M&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and auto time grain of 30 seconds', () => {
    beforeEach(() => {
      builder.timeGrain = 'auto';
      builder.grafanaInterval = '30s';
    });

    it('should always add datetime filtering and a time grain in ISO_8601 format to the filter', () => {
      const filter = timefilter + '&interval=PT1M&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and auto time grain of 10 minutes', () => {
    beforeEach(() => {
      builder.timeGrain = 'auto';
      builder.grafanaInterval = '10m';
    });

    it('should always add datetime filtering and a time grain rounded to the closest allowed value to the filter', () => {
      const filter = timefilter + '&interval=PT15M&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and auto time grain of 2 day', () => {
    beforeEach(() => {
      builder.timeGrain = 'auto';
      builder.grafanaInterval = '2d';
    });

    it('should always add datetime filtering and a time grain rounded to the closest allowed value to the filter', () => {
      const filter = timefilter + '&interval=P1D&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and 1 hour time grain', () => {
    it('should always add datetime filtering and a time grain in ISO_8601 format to the filter', () => {
      const filter = timefilter + '&interval=PT1H&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and 1 minute time grain', () => {
    beforeEach(() => {
      builder.timeGrain = 'PT1M';
    });

    it('should always add datetime filtering and a time grain in ISO_8601 format to the filter', () => {
      const filter = timefilter + '&interval=PT1M&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and 1 day time grain and an aggregation', () => {
    beforeEach(() => {
      builder.timeGrain = 'P1D';
      builder.setAggregation('Maximum');
    });

    it('should add time grain to the filter in ISO_8601 format', () => {
      const filter = timefilter + '&interval=P1D&aggregation=Maximum&' + metricFilter;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });

  describe('with a metric name and 1 day time grain and an aggregation and a dimension', () => {
    beforeEach(() => {
      builder.setDimensionFilter('aDimension', 'aFilterValue');
    });

    it('should add dimension to the filter', () => {
      const filter = timefilter + '&interval=PT1H&' + metricFilter + `&$filter=aDimension eq 'aFilterValue'`;
      expect(builder.generateFilter()).toEqual(filter);
    });
  });
});
