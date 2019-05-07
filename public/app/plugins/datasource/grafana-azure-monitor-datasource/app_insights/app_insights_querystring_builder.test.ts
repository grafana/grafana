import AppInsightsQuerystringBuilder from './app_insights_querystring_builder';
import { toUtc } from '@grafana/ui/src/utils/moment_wrapper';

describe('AppInsightsQuerystringBuilder', () => {
  let builder: AppInsightsQuerystringBuilder;

  beforeEach(() => {
    builder = new AppInsightsQuerystringBuilder(toUtc('2017-08-22 06:00'), toUtc('2017-08-22 07:00'), '1h');
  });

  describe('with only from/to date range', () => {
    it('should always add datetime filtering to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z`;
      expect(builder.generate()).toEqual(querystring);
    });
  });

  describe('with from/to date range and aggregation type', () => {
    beforeEach(() => {
      builder.setAggregation('avg');
    });

    it('should add datetime filtering and aggregation to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z&aggregation=avg`;
      expect(builder.generate()).toEqual(querystring);
    });
  });

  describe('with from/to date range and group by segment', () => {
    beforeEach(() => {
      builder.setGroupBy('client/city');
    });

    it('should add datetime filtering and segment to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z&segment=client/city`;
      expect(builder.generate()).toEqual(querystring);
    });
  });

  describe('with from/to date range and specific group by interval', () => {
    beforeEach(() => {
      builder.setInterval('specific', 1, 'hour');
    });

    it('should add datetime filtering and interval to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z&interval=PT1H`;
      expect(builder.generate()).toEqual(querystring);
    });
  });

  describe('with from/to date range and auto group by interval', () => {
    beforeEach(() => {
      builder.setInterval('auto', '', '');
    });

    it('should add datetime filtering and interval to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z&interval=PT1H`;
      expect(builder.generate()).toEqual(querystring);
    });
  });

  describe('with filter', () => {
    beforeEach(() => {
      builder.setFilter(`client/city eq 'Boydton'`);
    });

    it('should add datetime filtering and interval to the querystring', () => {
      const querystring = `timespan=2017-08-22T06:00:00Z/2017-08-22T07:00:00Z&filter=client/city eq 'Boydton'`;
      expect(builder.generate()).toEqual(querystring);
    });
  });
});
