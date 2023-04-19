import moment from 'moment';

import { ArrayVector, DataFrame, DataQueryRequest, DateTime, dateTime, TimeRange } from '@grafana/data/src';

import { InfluxQuery } from '../../influxdb/types';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { PromQuery } from '../types';

import { CacheRequestInfo, DatasourceProfileData, QueryCache } from './QueryCache';
import { IncrementalStorageDataFrameScenarios, IncrementalStorageDataFrameScenariosInflux } from './QueryCacheTestData';

// Will not interpolate vars!
const interpolateStringTest = (query: PromQuery) => {
  return query.expr;
};

const getPrometheusTargetSignature = (request: DataQueryRequest<PromQuery>, targ: PromQuery) => {
  return `${interpolateStringTest(targ)}|${targ.interval ?? request.interval}|${JSON.stringify(
    request.rangeRaw ?? ''
  )}|${targ.exemplar}`;
};

const getInfluxTargetSignature = (request: DataQueryRequest<InfluxQuery>, targ: InfluxQuery) => {
  return `${request.interval}|${JSON.stringify(request.rangeRaw ?? '')}|${targ.query}|${JSON.stringify(targ.select)}`;
};

const mockInfluxRequest = (request: Partial<DataQueryRequest<InfluxQuery>>): DataQueryRequest<InfluxQuery> => {
  const defaultRequest: DataQueryRequest<InfluxQuery> = {
    scopedVars: {
      __interval: { text: '50s', value: '60s' },
      __interval_ms: { text: '60000', value: 60000 },
      // @todo user variable?
    },
    startTime: 0,
    app: 'unknown',
    requestId: '',
    timezone: '',
    range: {
      from: moment('2023-01-30T19:33:01.332Z') as DateTime,
      to: moment('2023-01-30T20:33:01.332Z') as DateTime,
      raw: { from: 'now-5m', to: 'now' },
    },
    interval: '60ss',
    intervalMs: 60000,
    targets: [
      {
        rawQuery: true,
        query: 'SELECT * FROM cpu',
        datasource: { type: 'influx', uid: '8675309' },
        refId: 'A',
      },
    ],
  };

  return {
    ...defaultRequest,
    ...request,
  };
};

const mockPromRequest = (request?: Partial<DataQueryRequest<PromQuery>>): DataQueryRequest<PromQuery> => {
  // Histogram
  const defaultRequest: DataQueryRequest<PromQuery> = {
    app: 'undefined',
    requestId: '',
    timezone: '',
    range: {
      from: moment('2023-01-30T19:33:01.332Z') as DateTime,
      to: moment('2023-01-30T20:33:01.332Z') as DateTime,
      raw: { from: 'now-1h', to: 'now' },
    },
    interval: '15s',
    intervalMs: 15000,
    targets: [
      {
        datasource: { type: 'prometheus', uid: 'OPQv8Kc4z' },
        editorMode: QueryEditorMode.Code,
        exemplar: false,
        expr: 'sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[$__rate_interval]))',
        format: 'heatmap',
        legendFormat: '{{le}}',
        range: true,
        refId: 'A',
        utcOffsetSec: -21600,
      },
    ],
    maxDataPoints: 871,
    scopedVars: {
      __interval: { text: '15s', value: '15s' },
      __interval_ms: { text: '15000', value: 15000 },
    },
    startTime: 1675110781332,
    rangeRaw: { from: 'now-1h', to: 'now' },
  };
  return {
    ...defaultRequest,
    ...request,
  };
};

const getPromProfileData = (request: DataQueryRequest, targ: PromQuery): DatasourceProfileData => {
  return {
    expr: targ.expr,
    interval: targ.interval ?? request.interval,
    datasource: 'prom',
  };
};

const getInfluxProfileData = (request: DataQueryRequest, targ: InfluxQuery): DatasourceProfileData => {
  return {
    expr: targ.rawQuery && targ.query ? targ.query : JSON.stringify(targ.select),
    interval: request.interval,
    datasource: 'influx',
  };
};

describe('QueryCache: Generic', function () {
  it('instantiates', () => {
    const storage = new QueryCache(() => '', '10m', getPromProfileData);
    expect(storage).toBeInstanceOf(QueryCache);
  });

  it('will not modify or crash with empty response', () => {
    const storage = new QueryCache(() => '', '10m', getPromProfileData);
    const firstFrames: DataFrame[] = [];
    const secondFrames: DataFrame[] = [];

    const cache = new Map<string, string>();

    // start time of scenario
    const firstFrom = dateTime(new Date(1675262550000));
    // End time of scenario
    const firstTo = dateTime(new Date(1675262550000)).add(6, 'hours');

    const firstRange: TimeRange = {
      from: firstFrom,
      to: firstTo,
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    };

    // Same query 2 minutes later
    const numberOfSamplesLater = 4;
    const interval = 30000;

    const secondFrom = dateTime(new Date(1675262550000 + interval * numberOfSamplesLater));
    const secondTo = dateTime(new Date(1675262550000 + interval * numberOfSamplesLater)).add(6, 'hours');

    const secondRange: TimeRange = {
      from: secondFrom,
      to: secondTo,
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    };

    const targetSignature = `'1=1'|${interval}|${JSON.stringify(secondRange.raw)}`;
    const dashboardId = `dashid`;
    const panelId = 2;
    const targetIdentity = `${dashboardId}|${panelId}|A`;

    cache.set(targetIdentity, targetSignature);

    const firstStoredFrames = storage.procFrames(
      mockPromRequest({
        range: firstRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      }),
      {
        requests: [], // unused
        targSigs: cache,
        shouldCache: true,
      },
      firstFrames
    );

    const cached = storage.cache.get(targetIdentity);

    expect(cached?.frames[0].fields[0].values.length).toEqual(firstFrames[0]?.fields[0]?.values?.length);
    expect(firstStoredFrames[0]?.fields[0].values.length).toEqual(firstFrames[0]?.fields[0]?.values?.length);

    // Should return the request frames unaltered
    expect(firstStoredFrames).toEqual(firstFrames);

    const secondRequest = mockPromRequest({
      range: secondRange,
      dashboardUID: dashboardId,
      panelId: panelId,
    });

    const secondStoredFrames = storage.procFrames(
      secondRequest,
      {
        requests: [], // unused
        targSigs: cache,
        shouldCache: true,
      },
      secondFrames
    );

    const storageLengthAfterSubsequentQuery = storage.cache.get(targetIdentity);

    expect(secondStoredFrames).toEqual([]);

    storageLengthAfterSubsequentQuery?.frames.forEach((dataFrame, index) => {
      const secondFramesLength = secondFrames[index].fields[0].values.length;
      const firstFramesLength = firstFrames[index].fields[0].values.length;

      const cacheLength = dataFrame.fields[0].values.length;

      // Cache can contain more, but never less
      expect(cacheLength).toBeGreaterThanOrEqual(secondFramesLength + firstFramesLength - (20 + numberOfSamplesLater));

      // Fewer results are sent in incremental result
      expect(firstFramesLength).toBeGreaterThan(secondFramesLength);
    });
  });
});

describe('QueryCache: Prometheus', function () {
  it('Merges incremental queries in storage', () => {
    const scenarios = [
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtEnd(),
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapInMiddle(),
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtStart(),
    ];
    scenarios.forEach((scenario, index) => {
      const storage = new QueryCache<PromQuery>(getPrometheusTargetSignature, '10m', getPromProfileData);
      const firstFrames = scenario.first.dataFrames as unknown as DataFrame[];
      const secondFrames = scenario.second.dataFrames as unknown as DataFrame[];

      const targetSignatures = new Map<string, string>();

      // start time of scenario
      const firstFrom = dateTime(new Date(1675262550000));
      // End time of scenario
      const firstTo = dateTime(new Date(1675262550000)).add(6, 'hours');

      const firstRange: TimeRange = {
        from: firstFrom,
        to: firstTo,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      };

      // Same query 2 minutes later
      const numberOfSamplesLater = 4;
      const interval = 30000;

      const secondFrom = dateTime(new Date(1675262550000 + interval * numberOfSamplesLater));
      const secondTo = dateTime(new Date(1675262550000 + interval * numberOfSamplesLater)).add(6, 'hours');

      const secondRange: TimeRange = {
        from: secondFrom,
        to: secondTo,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      };

      const dashboardId = `dashid--${index}`;
      const panelId = 2 + index;

      // This can't change
      const targetIdentity = `${dashboardId}|${panelId}|A`;

      const request = mockPromRequest({
        range: firstRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      });

      // But the signature can, and we should clean up any non-matching signatures
      const targetSignature = getPrometheusTargetSignature(request, request.targets[0]);

      targetSignatures.set(targetIdentity, targetSignature);

      const firstStoredFrames = storage.procFrames(
        request,
        {
          requests: [], // unused
          targSigs: targetSignatures,
          shouldCache: true,
        },
        firstFrames
      );

      const cached = storage.cache.get(targetIdentity);

      // I would expect that the number of values received from the API should be the same as the cached values?
      expect(cached?.frames[0].fields[0].values.length).toEqual(firstFrames[0].fields[0].values.length);

      // Should return the request frames unaltered
      expect(firstStoredFrames).toEqual(firstFrames);

      const secondRequest = mockPromRequest({
        range: secondRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      });

      const secondStoredFrames = storage.procFrames(
        secondRequest,
        {
          requests: [], // unused
          targSigs: targetSignatures,
          shouldCache: true,
        },
        secondFrames
      );

      const storageLengthAfterSubsequentQuery = storage.cache.get(targetIdentity);

      storageLengthAfterSubsequentQuery?.frames.forEach((dataFrame, index) => {
        const secondFramesLength = secondFrames[index].fields[0].values.length;
        const firstFramesLength = firstFrames[index].fields[0].values.length;

        const cacheLength = dataFrame.fields[0].values.length;

        // Cache can contain more, but never less
        expect(cacheLength).toBeGreaterThanOrEqual(
          secondFramesLength + firstFramesLength - (20 + numberOfSamplesLater)
        );

        // Fewer results are sent in incremental result
        expect(firstFramesLength).toBeGreaterThan(secondFramesLength);
      });

      // All of the new values should be the ones that were stored, this is overkill
      secondFrames.forEach((frame, frameIdx) => {
        frame.fields.forEach((field, fieldIdx) => {
          secondFrames[frameIdx].fields[fieldIdx].values.toArray().forEach((value) => {
            expect(secondStoredFrames[frameIdx].fields[fieldIdx].values).toContain(value);
          });
        });
      });

      const secondRequestModified = {
        ...secondRequest,
        range: {
          ...secondRequest.range,
          to: dateTime(secondRequest.range.to.valueOf() + 30000),
        },
      };
      const cacheRequest = storage.requestInfo(secondRequestModified);
      expect(cacheRequest.requests[0].targets).toEqual(secondRequestModified.targets);
      expect(cacheRequest.requests[0].range.to).toEqual(secondRequestModified.range.to);
      expect(cacheRequest.requests[0].range.raw).toEqual(secondRequestModified.range.raw);
      expect(cacheRequest.requests[0].range.from.valueOf() - 21000000).toEqual(
        secondRequestModified.range.from.valueOf()
      );
      expect(cacheRequest.shouldCache).toBe(true);
    });
  });

  it('Will evict old dataframes, and use stored data when user shortens query window', () => {
    const storage = new QueryCache<PromQuery>(getPrometheusTargetSignature, '10m', getPromProfileData);

    // Initial request with all data for time range
    const firstFrames = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.first
      .dataFrames as unknown as DataFrame[];

    // Shortened request 30s later
    const secondFrames = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.second
      .dataFrames as unknown as DataFrame[];

    // Now the user waits a minute and changes the query duration to just the last 5 minutes, luckily the interval hasn't changed, so we can still use the data in storage except for the latest minute
    const thirdFrames = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.second
      .dataFrames as unknown as DataFrame[];

    const cache = new Map<string, string>();
    const interval = 15000;

    // start time of scenario
    const firstFrom = dateTime(new Date(1675107180000));
    const firstTo = dateTime(new Date(1675107180000)).add(1, 'hours');
    const firstRange: TimeRange = {
      from: firstFrom,
      to: firstTo,
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    // 30 seconds later
    const secondNumberOfSamplesLater = 2;
    const secondFrom = dateTime(new Date(1675107180000 + interval * secondNumberOfSamplesLater));
    const secondTo = dateTime(new Date(1675107180000 + interval * secondNumberOfSamplesLater)).add(1, 'hours');
    const secondRange: TimeRange = {
      from: secondFrom,
      to: secondTo,
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    // 1 minute + 30 seconds later, but 5 minute viewing window
    const thirdNumberOfSamplesLater = 6;
    const thirdFrom = dateTime(new Date(1675107180000 + interval * thirdNumberOfSamplesLater));
    const thirdTo = dateTime(new Date(1675107180000 + interval * thirdNumberOfSamplesLater)).add(5, 'minutes');
    const thirdRange: TimeRange = {
      from: thirdFrom,
      to: thirdTo,
      raw: {
        from: 'now-5m',
        to: 'now',
      },
    };

    // Signifier definition

    const dashboardId = `dashid`;
    const panelId = 200;

    const targetIdentity = `${dashboardId}|${panelId}|A`;

    const request = mockPromRequest({
      range: firstRange,
      dashboardUID: dashboardId,
      panelId: panelId,
    });

    const requestInfo = {
      requests: [], // unused
      targSigs: cache,
      shouldCache: true,
    };
    const targetSignature = `1=1|${interval}|${JSON.stringify(request.rangeRaw ?? '')}`;
    cache.set(targetIdentity, targetSignature);

    const firstQueryResult = storage.procFrames(request, requestInfo, firstFrames);

    const firstMergedLength = firstQueryResult[0].fields[0].values.length;

    const secondQueryResult = storage.procFrames(
      mockPromRequest({
        range: secondRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      }),
      {
        requests: [], // unused
        targSigs: cache,
        shouldCache: true,
      },
      secondFrames
    );

    const secondMergedLength = secondQueryResult[0].fields[0].values.length;

    // Since the step is 15s, and the request was 30 seconds later, we should have 2 extra frames, but we should evict the first two, so we should get the same length
    expect(firstMergedLength).toEqual(secondMergedLength);
    expect(firstQueryResult[0].fields[0].values.toArray()[2]).toEqual(
      secondQueryResult[0].fields[0].values.toArray()[0]
    );
    expect(firstQueryResult[0].fields[0].values.toArray()[0] + 30000).toEqual(
      secondQueryResult[0].fields[0].values.toArray()[0]
    );

    cache.set(targetIdentity, `'1=1'|${interval}|${JSON.stringify(thirdRange.raw)}`);

    storage.procFrames(
      mockPromRequest({
        range: thirdRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      }),
      {
        requests: [], // unused
        targSigs: cache,
        shouldCache: true,
      },
      thirdFrames
    );

    const cachedAfterThird = storage.cache.get(targetIdentity);
    const storageLengthAfterThirdQuery = cachedAfterThird?.frames[0].fields[0].values.toArray().length;
    expect(storageLengthAfterThirdQuery).toEqual(20);
  });

  it('Will build signature using target overrides', () => {
    const targetInterval = '30s';
    const requestInterval = '15s';

    const target: PromQuery = {
      datasource: { type: 'prometheus', uid: 'OPQv8Kc4z' },
      editorMode: QueryEditorMode.Code,
      exemplar: false,
      expr: 'sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[$__rate_interval]))',
      format: 'heatmap',
      interval: targetInterval,
      legendFormat: '{{le}}',
      range: true,
      refId: 'A',
      utcOffsetSec: -21600,
    };

    const request = mockPromRequest({
      interval: requestInterval,
      targets: [target],
    });
    const targSig = getPrometheusTargetSignature(request, target);
    expect(targSig).toContain(targetInterval);
    expect(targSig.includes(requestInterval)).toBeFalsy();
  });

  it('will not modify request with absolute duration', () => {
    const request = mockPromRequest({
      range: {
        from: moment('2023-01-30T19:33:01.332Z') as DateTime,
        to: moment('2023-01-30T20:33:01.332Z') as DateTime,
        raw: { from: '2023-01-30T19:33:01.332Z', to: '2023-01-30T20:33:01.332Z' },
      },
      rangeRaw: { from: '2023-01-30T19:33:01.332Z', to: '2023-01-30T20:33:01.332Z' },
    });
    const storage = new QueryCache<PromQuery>(getPrometheusTargetSignature, '10m', getPromProfileData);
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(false);
  });

  it('mark request as shouldCache', () => {
    const request = mockPromRequest();
    const storage = new QueryCache<PromQuery>(getPrometheusTargetSignature, '10m', getPromProfileData);
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(true);
  });

  it('Should modify request', () => {
    const request = mockPromRequest();
    const storage = new QueryCache<PromQuery>(getPrometheusTargetSignature, '10m', getPromProfileData);
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(true);
  });
});

describe('QueryCache: Influx', function () {
  it('avoids removing frames in influx 2', () => {
    const storage = new QueryCache<InfluxQuery>(getInfluxTargetSignature, '1m', getInfluxProfileData);

    const cache = new Map<string, string>();

    const dashboardId = `dashid`;
    const panelId = 1;

    const firstRequest = {
      app: 'dashboard',
      requestId: 'Q100',
      timezone: 'browser',
      panelId: panelId,
      dashboardUID: dashboardId,
      publicDashboardAccessToken: '',
      range: {
        from: dateTime('2023-04-05T19:01:22.111Z'),
        to: dateTime('2023-04-05T19:06:22.111Z'),
        raw: {
          from: 'now-5m',
          to: 'now',
        },
      },
      timeInfo: '',
      interval: '500ms',
      intervalMs: 500,
      targets: [
        {
          datasource: {
            type: 'influxdb',
            uid: 'P8E9168127D59652D',
          },
          groupBy: [
            {
              params: ['$__interval'],
              type: 'time',
            },
            {
              params: ['null'],
              type: 'fill',
            },
          ],
          key: 'Q-55004e82-81c5-4da2-a546-59f944995e17-0',
          measurement: 'cpu',
          orderByTime: 'ASC',
          policy: 'default',
          refId: 'A',
          resultFormat: 'time_series',
          select: [
            [
              {
                params: ['usage_system'],
                type: 'field',
              },
              {
                params: [],
                type: 'mean',
              },
            ],
          ],
          tags: [],
        },
      ],
      maxDataPoints: 832,
      scopedVars: {
        __interval: {
          text: '500ms',
          value: '500ms',
        },
        __interval_ms: {
          text: '500',
          value: 500,
        },
      },
      startTime: 1680721582112,
      rangeRaw: {
        from: 'now-5m',
        to: 'now',
      },
      endTime: 1680721582158,
    } as DataQueryRequest<InfluxQuery>;
    const firstRequestInfo = {
      requests: [],
      targSigs: cache,
      shouldCache: true,
    } as CacheRequestInfo<InfluxQuery>;
    const firstFrames = [
      {
        name: 'cpu.mean',
        refId: 'A',
        meta: {
          typeVersion: [0, 0],
          executedQueryString:
            'SELECT mean("usage_system") FROM "cpu" WHERE time >= 1680721282111ms and time <= 1680721582111ms GROUP BY time(500ms) fill(null) ORDER BY time ASC',
        },
        fields: [
          {
            name: 'time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {},
            values: new ArrayVector([
              1680721291000, 1680721291500, 1680721292000, 1680721292500, 1680721293000, 1680721293500, 1680721294000,
              1680721294500, 1680721295000, 1680721295500, 1680721296000, 1680721296500, 1680721297000, 1680721297500,
              1680721298000, 1680721298500, 1680721299000, 1680721299500, 1680721300000, 1680721300500, 1680721301000,
              1680721301500, 1680721302000, 1680721302500, 1680721303000, 1680721303500, 1680721304000, 1680721304500,
              1680721305000, 1680721305500, 1680721306000, 1680721306500, 1680721307000, 1680721307500, 1680721308000,
              1680721308500, 1680721309000, 1680721309500, 1680721310000, 1680721310500, 1680721311000, 1680721311500,
              1680721312000, 1680721312500, 1680721313000, 1680721313500, 1680721314000, 1680721314500, 1680721315000,
              1680721315500, 1680721316000, 1680721316500, 1680721317000, 1680721317500, 1680721318000, 1680721318500,
              1680721319000, 1680721319500, 1680721320000, 1680721320500, 1680721321000, 1680721321500, 1680721322000,
              1680721322500, 1680721323000, 1680721323500, 1680721324000, 1680721324500, 1680721325000, 1680721325500,
              1680721326000, 1680721326500, 1680721327000, 1680721327500, 1680721328000, 1680721328500, 1680721329000,
              1680721329500, 1680721330000, 1680721330500, 1680721331000, 1680721331500, 1680721332000, 1680721332500,
              1680721333000, 1680721333500, 1680721334000, 1680721334500, 1680721335000, 1680721335500, 1680721336000,
              1680721336500, 1680721337000, 1680721337500, 1680721338000, 1680721338500, 1680721339000, 1680721339500,
              1680721340000, 1680721340500, 1680721341000, 1680721341500, 1680721342000, 1680721342500, 1680721343000,
              1680721343500, 1680721344000, 1680721344500, 1680721345000, 1680721345500, 1680721346000, 1680721346500,
              1680721347000, 1680721347500, 1680721348000, 1680721348500, 1680721349000, 1680721349500, 1680721350000,
              1680721350500, 1680721351000, 1680721351500, 1680721352000, 1680721352500, 1680721353000, 1680721353500,
              1680721354000, 1680721354500, 1680721355000, 1680721355500, 1680721356000, 1680721356500, 1680721357000,
              1680721357500, 1680721358000, 1680721358500, 1680721359000, 1680721359500, 1680721360000, 1680721360500,
              1680721361000, 1680721361500, 1680721362000, 1680721362500, 1680721363000, 1680721363500, 1680721364000,
              1680721364500, 1680721365000, 1680721365500, 1680721366000, 1680721366500, 1680721367000, 1680721367500,
              1680721368000, 1680721368500, 1680721369000, 1680721369500, 1680721370000, 1680721370500, 1680721371000,
              1680721371500, 1680721372000, 1680721372500, 1680721373000, 1680721373500, 1680721374000, 1680721374500,
              1680721375000, 1680721375500, 1680721376000, 1680721376500, 1680721377000, 1680721377500, 1680721378000,
              1680721378500, 1680721379000, 1680721379500, 1680721380000, 1680721380500, 1680721381000, 1680721381500,
              1680721382000, 1680721382500, 1680721383000, 1680721383500, 1680721384000, 1680721384500, 1680721385000,
              1680721385500, 1680721386000, 1680721386500, 1680721387000, 1680721387500, 1680721388000, 1680721388500,
              1680721389000, 1680721389500, 1680721390000, 1680721390500, 1680721391000, 1680721391500, 1680721392000,
              1680721392500, 1680721393000, 1680721393500, 1680721394000, 1680721394500, 1680721395000, 1680721395500,
              1680721396000, 1680721396500, 1680721397000, 1680721397500, 1680721398000, 1680721398500, 1680721399000,
              1680721399500, 1680721400000, 1680721400500, 1680721401000, 1680721401500, 1680721402000, 1680721402500,
              1680721403000, 1680721403500, 1680721404000, 1680721404500, 1680721405000, 1680721405500, 1680721406000,
              1680721406500, 1680721407000, 1680721407500, 1680721408000, 1680721408500, 1680721409000, 1680721409500,
              1680721410000, 1680721410500, 1680721411000, 1680721411500, 1680721412000, 1680721412500, 1680721413000,
              1680721413500, 1680721414000, 1680721414500, 1680721415000, 1680721415500, 1680721416000, 1680721416500,
              1680721417000, 1680721417500, 1680721418000, 1680721418500, 1680721419000, 1680721419500, 1680721420000,
              1680721420500, 1680721421000, 1680721421500, 1680721422000, 1680721422500, 1680721423000, 1680721423500,
              1680721424000, 1680721424500, 1680721425000, 1680721425500, 1680721426000, 1680721426500, 1680721427000,
              1680721427500, 1680721428000, 1680721428500, 1680721429000, 1680721429500, 1680721430000, 1680721430500,
              1680721431000, 1680721431500, 1680721432000, 1680721432500, 1680721433000, 1680721433500, 1680721434000,
              1680721434500, 1680721435000, 1680721435500, 1680721436000, 1680721436500, 1680721437000, 1680721437500,
              1680721438000, 1680721438500, 1680721439000, 1680721439500, 1680721440000, 1680721440500, 1680721441000,
              1680721441500, 1680721442000, 1680721442500, 1680721443000, 1680721443500, 1680721444000, 1680721444500,
              1680721445000, 1680721445500, 1680721446000, 1680721446500, 1680721447000, 1680721447500, 1680721448000,
              1680721448500, 1680721449000, 1680721449500, 1680721450000, 1680721450500, 1680721451000, 1680721451500,
              1680721452000, 1680721452500, 1680721453000, 1680721453500, 1680721454000, 1680721454500, 1680721455000,
              1680721455500, 1680721456000, 1680721456500, 1680721457000, 1680721457500, 1680721458000, 1680721458500,
              1680721459000, 1680721459500, 1680721460000, 1680721460500, 1680721461000, 1680721461500, 1680721462000,
              1680721462500, 1680721463000, 1680721463500, 1680721464000, 1680721464500, 1680721465000, 1680721465500,
              1680721466000, 1680721466500, 1680721467000, 1680721467500, 1680721468000, 1680721468500, 1680721469000,
              1680721469500, 1680721470000, 1680721470500, 1680721471000, 1680721471500, 1680721472000, 1680721472500,
              1680721473000, 1680721473500, 1680721474000, 1680721474500, 1680721475000, 1680721475500, 1680721476000,
              1680721476500, 1680721477000, 1680721477500, 1680721478000, 1680721478500, 1680721479000, 1680721479500,
              1680721480000, 1680721480500, 1680721481000, 1680721481500, 1680721482000, 1680721482500, 1680721483000,
              1680721483500, 1680721484000, 1680721484500, 1680721485000, 1680721485500, 1680721486000, 1680721486500,
              1680721487000, 1680721487500, 1680721488000, 1680721488500, 1680721489000, 1680721489500, 1680721490000,
              1680721490500, 1680721491000, 1680721491500, 1680721492000, 1680721492500, 1680721493000, 1680721493500,
              1680721494000, 1680721494500, 1680721495000, 1680721495500, 1680721496000, 1680721496500, 1680721497000,
              1680721497500, 1680721498000, 1680721498500, 1680721499000, 1680721499500, 1680721500000, 1680721500500,
              1680721501000, 1680721501500, 1680721502000, 1680721502500, 1680721503000, 1680721503500, 1680721504000,
              1680721504500, 1680721505000, 1680721505500, 1680721506000, 1680721506500, 1680721507000, 1680721507500,
              1680721508000, 1680721508500, 1680721509000, 1680721509500, 1680721510000, 1680721510500, 1680721511000,
              1680721511500, 1680721512000, 1680721512500, 1680721513000, 1680721513500, 1680721514000, 1680721514500,
              1680721515000, 1680721515500, 1680721516000, 1680721516500, 1680721517000, 1680721517500, 1680721518000,
              1680721518500, 1680721519000, 1680721519500, 1680721520000, 1680721520500, 1680721521000, 1680721521500,
              1680721522000, 1680721522500, 1680721523000, 1680721523500, 1680721524000, 1680721524500, 1680721525000,
              1680721525500, 1680721526000, 1680721526500, 1680721527000, 1680721527500, 1680721528000, 1680721528500,
              1680721529000, 1680721529500, 1680721530000, 1680721530500, 1680721531000, 1680721531500, 1680721532000,
              1680721532500, 1680721533000, 1680721533500, 1680721534000, 1680721534500, 1680721535000, 1680721535500,
              1680721536000, 1680721536500, 1680721537000, 1680721537500, 1680721538000, 1680721538500, 1680721539000,
              1680721539500, 1680721540000, 1680721540500, 1680721541000, 1680721541500, 1680721542000, 1680721542500,
              1680721543000, 1680721543500, 1680721544000, 1680721544500, 1680721545000, 1680721545500, 1680721546000,
              1680721546500, 1680721547000, 1680721547500, 1680721548000, 1680721548500, 1680721549000, 1680721549500,
              1680721550000, 1680721550500, 1680721551000, 1680721551500, 1680721552000, 1680721552500, 1680721553000,
              1680721553500, 1680721554000, 1680721554500, 1680721555000, 1680721555500, 1680721556000, 1680721556500,
              1680721557000, 1680721557500, 1680721558000, 1680721558500, 1680721559000, 1680721559500, 1680721560000,
              1680721560500, 1680721561000, 1680721561500, 1680721562000, 1680721562500, 1680721563000, 1680721563500,
              1680721564000, 1680721564500, 1680721565000, 1680721565500, 1680721566000, 1680721566500, 1680721567000,
              1680721567500, 1680721568000, 1680721568500, 1680721569000, 1680721569500, 1680721570000, 1680721570500,
              1680721571000, 1680721571500, 1680721572000, 1680721572500, 1680721573000, 1680721573500, 1680721574000,
              1680721574500, 1680721575000, 1680721575500, 1680721576000, 1680721576500, 1680721577000, 1680721577500,
              1680721578000, 1680721578500, 1680721579000, 1680721579500, 1680721580000, 1680721580500, 1680721581000,
              1680721581500, 1680721582000, 1680721582500, 1680721583000, 1680721583500, 1680721584000, 1680721584500,
              1680721585000, 1680721585500, 1680721586000, 1680721586500, 1680721587000, 1680721587500, 1680721588000,
              1680721588500, 1680721589000, 1680721589500, 1680721590000, 1680721590500,
            ]),
          },
          {
            name: 'value',
            type: 'number',
            config: {
              displayNameFromDS: 'cpu.mean',
            },
            values: new ArrayVector([
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.35194092078671396,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.6684174942915931,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.7551067407210168,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.5715912013943909,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.33191198460178606,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.384767023400456,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.36814775367093816,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3706205978233309,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3819551890618273,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3682263235431513,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.306271841429158,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.4637917412028196,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3709653939083925,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.2653246204940871,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.2845496079061911,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.2510644134927929,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3704541161205738,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.26253826473850045,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.47389887168569167,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.2674949293543939,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.363307210405348,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.272648372822676,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.2815921477827505,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3510560647298928,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.23664065957163727,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.583514777063943,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.28480071273039625,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.31736074390222807,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ]),
          },
        ],
        length: 601,
      },
    ] as DataFrame[];

    // This can't change
    const targetIdentity = `${dashboardId}|${panelId}|A`;

    // But the signature can, and we should clean up any non-matching signatures
    const targetSignature = getInfluxTargetSignature(mockInfluxRequest(firstRequest), firstRequest.targets[0]);

    cache.set(targetIdentity, targetSignature);

    const firstStoredFrames = storage.procFrames(firstRequest, firstRequestInfo, firstFrames);

    const valuesAfterFirst = storage.cache
      .get(targetIdentity)
      ?.frames[0].fields[1].values.toArray()
      ?.map((value, idx) => {
        return { value: value, originalIndex: idx };
      })
      .filter((value) => value.value !== null);

    expect(valuesAfterFirst?.length).toBe(28);

    expect(firstStoredFrames[0].fields[0].values.length).toBe(582);

    const secondRequest = mockInfluxRequest({
      app: 'dashboard',
      requestId: 'Q110',
      timezone: 'browser',
      panelId: panelId,
      dashboardUID: dashboardId,
      publicDashboardAccessToken: '',
      range: {
        from: dateTime('2023-04-05T19:01:30.612Z'),
        to: dateTime('2023-04-05T19:06:30.612Z'),
        raw: {
          from: 'now-5m',
          to: 'now',
        },
      },
      timeInfo: '',
      interval: '500ms',
      intervalMs: 500,
      targets: [
        {
          datasource: {
            type: 'influxdb',
            uid: 'P8E9168127D59652D',
          },
          groupBy: [
            {
              params: ['$__interval'],
              type: 'time',
            },
            {
              params: ['null'],
              type: 'fill',
            },
          ],
          key: 'Q-55004e82-81c5-4da2-a546-59f944995e17-0',
          measurement: 'cpu',
          orderByTime: 'ASC',
          policy: 'default',
          refId: 'A',
          resultFormat: 'time_series',
          select: [
            [
              {
                params: ['usage_system'],
                type: 'field',
              },
              {
                params: [],
                type: 'mean',
              },
            ],
          ],
          tags: [],
        },
      ],
      maxDataPoints: 832,
      scopedVars: {
        __interval: {
          text: '500ms',
          value: '500ms',
        },
        __interval_ms: {
          text: '500',
          value: 500,
        },
      },
      startTime: 1680721590613,
      rangeRaw: {
        from: 'now-5m',
        to: 'now',
      },
      endTime: 1680721590642,
    }) as DataQueryRequest<InfluxQuery>;

    const secondRequestInfo = {
      requests: [
        {
          app: 'dashboard',
          requestId: 'Q110',
          timezone: 'browser',
          panelId: 1,
          dashboardUID: 'e74c7505-cf1e-4605-bd6b-a043324e6dc5',
          publicDashboardAccessToken: '',
          range: {
            from: dateTime('2023-04-05T19:05:30.046Z'),
            to: dateTime('2023-04-05T19:06:30.612Z'),
            raw: {
              from: 'now-5m',
              to: 'now',
            },
          },
          timeInfo: '',
          interval: '500ms',
          intervalMs: 500,
          targets: [
            {
              datasource: {
                type: 'influxdb',
                uid: 'P8E9168127D59652D',
              },
              groupBy: [
                {
                  params: ['$__interval'],
                  type: 'time',
                },
                {
                  params: ['null'],
                  type: 'fill',
                },
              ],
              key: 'Q-55004e82-81c5-4da2-a546-59f944995e17-0',
              measurement: 'cpu',
              orderByTime: 'ASC',
              policy: 'default',
              refId: 'A',
              resultFormat: 'time_series',
              select: [
                [
                  {
                    params: ['usage_system'],
                    type: 'field',
                  },
                  {
                    params: [],
                    type: 'mean',
                  },
                ],
              ],
              tags: [],
            },
          ],
          maxDataPoints: 832,
          scopedVars: {
            __interval: {
              text: '500ms',
              value: '500ms',
            },
            __interval_ms: {
              text: '500',
              value: 500,
            },
          },
          startTime: 1680721590613,
          rangeRaw: {
            from: 'now-5m',
            to: 'now',
          },
        },
      ],
      targSigs: cache,
      shouldCache: true,
    } as CacheRequestInfo<InfluxQuery>;
    const secondFrames = [
      {
        name: 'cpu.mean',
        refId: 'A',
        meta: {
          typeVersion: [0, 0],
          executedQueryString:
            'SELECT mean("usage_system") FROM "cpu" WHERE time >= 1680721530046ms and time <= 1680721590612ms GROUP BY time(500ms) fill(null) ORDER BY time ASC',
        },
        fields: [
          {
            name: 'time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {},
            values: new ArrayVector([
              1680721530000, 1680721530500, 1680721531000, 1680721531500, 1680721532000, 1680721532500, 1680721533000,
              1680721533500, 1680721534000, 1680721534500, 1680721535000, 1680721535500, 1680721536000, 1680721536500,
              1680721537000, 1680721537500, 1680721538000, 1680721538500, 1680721539000, 1680721539500, 1680721540000,
              1680721540500, 1680721541000, 1680721541500, 1680721542000, 1680721542500, 1680721543000, 1680721543500,
              1680721544000, 1680721544500, 1680721545000, 1680721545500, 1680721546000, 1680721546500, 1680721547000,
              1680721547500, 1680721548000, 1680721548500, 1680721549000, 1680721549500, 1680721550000, 1680721550500,
              1680721551000, 1680721551500, 1680721552000, 1680721552500, 1680721553000, 1680721553500, 1680721554000,
              1680721554500, 1680721555000, 1680721555500, 1680721556000, 1680721556500, 1680721557000, 1680721557500,
              1680721558000, 1680721558500, 1680721559000, 1680721559500, 1680721560000, 1680721560500, 1680721561000,
              1680721561500, 1680721562000, 1680721562500, 1680721563000, 1680721563500, 1680721564000, 1680721564500,
              1680721565000, 1680721565500, 1680721566000, 1680721566500, 1680721567000, 1680721567500, 1680721568000,
              1680721568500, 1680721569000, 1680721569500, 1680721570000, 1680721570500, 1680721571000, 1680721571500,
              1680721572000, 1680721572500, 1680721573000, 1680721573500, 1680721574000, 1680721574500, 1680721575000,
              1680721575500, 1680721576000, 1680721576500, 1680721577000, 1680721577500, 1680721578000, 1680721578500,
              1680721579000, 1680721579500, 1680721580000, 1680721580500, 1680721581000, 1680721581500, 1680721582000,
              1680721582500, 1680721583000, 1680721583500, 1680721584000, 1680721584500, 1680721585000, 1680721585500,
              1680721586000, 1680721586500, 1680721587000, 1680721587500, 1680721588000, 1680721588500, 1680721589000,
              1680721589500, 1680721590000, 1680721590500,
            ]),
            entities: {},
          },
          {
            name: 'value',
            type: 'number',
            config: {
              displayNameFromDS: 'cpu.mean',
            },
            values: new ArrayVector([
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.3510560647298928,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.23664065957163727,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.583514777063943,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.28480071273039625,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              0.31736074390222807,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ]),
          },
        ],
        length: 122,
      },
    ] as DataFrame[];

    const secondStoredFrames = storage.procFrames(secondRequest, secondRequestInfo, secondFrames as DataFrame[]);

    expect(secondStoredFrames[0].fields[1].values.toArray().filter((v) => v !== null).length).toBe(28);
    expect(secondStoredFrames[0].fields[0].values.toArray().filter((v) => v !== null).length).toBe(600);

    const valuesAfterSecond = storage.cache
      .get(targetIdentity)
      ?.frames[0].fields[1].values.toArray()
      ?.map((value, idx) => {
        return { value: value, originalIndex: idx };
      })
      .filter((value) => value.value !== null);

    expect(valuesAfterSecond?.length ?? 0).toBe(28);
  });
  it('is reproduction of bug from raw data', () => {
    const storage = new QueryCache(getInfluxTargetSignature, '30s', getInfluxProfileData);
    const firstRequestInfo = storage.requestInfo(
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.first.initial as DataQueryRequest<InfluxQuery>
    );
    storage.procFrames(
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.first.request as DataQueryRequest<InfluxQuery>,
      firstRequestInfo,
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.first.dataFrames as DataFrame[]
    );

    const valuesAfterFirst = storage.cache
      .get('e74c7505-cf1e-4605-bd6b-a043324e6dc5|1|A')
      ?.frames[0].fields[1].values.toArray()
      ?.map((value, idx) => {
        return { value: value, originalIndex: idx };
      })
      .filter((value) => value.value !== null);

    expect(valuesAfterFirst?.length ?? 0).toBe(89);

    const secondRequestInfo = storage.requestInfo(
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.second.initial as DataQueryRequest<InfluxQuery>
    );
    storage.procFrames(
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.second.request as DataQueryRequest<InfluxQuery>,
      secondRequestInfo,
      IncrementalStorageDataFrameScenariosInflux.missingRecords2.second.dataFrames as DataFrame[]
    );

    const valuesAfterSecond = storage.cache
      .get('e74c7505-cf1e-4605-bd6b-a043324e6dc5|1|A')
      ?.frames[0].fields[1].values.toArray()
      ?.map((value, idx) => {
        return { value: value, originalIndex: idx };
      })
      .filter((value) => value.value !== null);

    const valuesOnly = valuesAfterSecond?.map((value) => value.value);

    // Will fail
    valuesAfterFirst?.forEach((value) => {
      expect(valuesOnly).toContainEqual(value.value);
    });

    // Will fail
    expect(valuesAfterSecond?.length ?? 0).toBe(89);
  });
});
