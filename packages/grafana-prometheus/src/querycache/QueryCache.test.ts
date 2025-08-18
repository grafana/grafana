// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querycache/QueryCache.test.ts
import moment from 'moment';

import { DataFrame, DataQueryRequest, DateTime, dateTime, TimeRange } from '@grafana/data';

import { QueryEditorMode } from '../querybuilder/shared/types';
import { PromQuery } from '../types';

import { CacheRequestInfo, findDatapointStep, QueryCache } from './QueryCache';
import {
  differentDisplayNameFromDS,
  trimmedFirstPointInPromFrames,
  IncrementalStorageDataFrameScenarios,
} from './QueryCacheTestData';

// Will not interpolate vars!
const interpolateStringTest = (query: PromQuery) => {
  return query.expr;
};

const getPrometheusTargetSignature = (request: DataQueryRequest<PromQuery>, targ: PromQuery) => {
  return `${interpolateStringTest(targ)}|${targ.interval ?? request.interval}|${JSON.stringify(
    request.rangeRaw ?? ''
  )}|${targ.exemplar}`;
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

describe('QueryCache: Generic', function () {
  it('instantiates', () => {
    const storage = new QueryCache({
      getTargetSignature: () => '',
      overlapString: '10m',
    });
    expect(storage).toBeInstanceOf(QueryCache);
  });

  it('will not modify or crash with empty response', () => {
    const storage = new QueryCache({
      getTargetSignature: () => '',
      overlapString: '10m',
    });
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
        targetSignatures: cache,
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
        targetSignatures: cache,
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
      const storage = new QueryCache<PromQuery>({
        getTargetSignature: getPrometheusTargetSignature,
        overlapString: '10m',
      });
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
          targetSignatures: targetSignatures,
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
          targetSignatures: targetSignatures,
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
          secondFrames[frameIdx].fields[fieldIdx].values.forEach((value) => {
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
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });

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

    const requestInfo: CacheRequestInfo<PromQuery> = {
      requests: [], // unused
      targetSignatures: cache,
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
        targetSignatures: cache,
        shouldCache: true,
      },
      secondFrames
    );

    const secondMergedLength = secondQueryResult[0].fields[0].values.length;

    // Since the step is 15s, and the request was 30 seconds later, we should have 2 extra frames, but we should evict the first one so we keep one datapoint before the new from so the first datapoint in view connects to the y-axis
    expect(firstMergedLength + 1).toEqual(secondMergedLength);
    expect(firstQueryResult[0].fields[0].values[1]).toEqual(secondQueryResult[0].fields[0].values[0]);
    expect(firstQueryResult[0].fields[0].values[0] + 30000).toEqual(secondQueryResult[0].fields[0].values[1]);

    cache.set(targetIdentity, `'1=1'|${interval}|${JSON.stringify(thirdRange.raw)}`);

    storage.procFrames(
      mockPromRequest({
        range: thirdRange,
        dashboardUID: dashboardId,
        panelId: panelId,
      }),
      {
        requests: [], // unused
        targetSignatures: cache,
        shouldCache: true,
      },
      thirdFrames
    );

    const cachedAfterThird = storage.cache.get(targetIdentity);
    const storageLengthAfterThirdQuery = cachedAfterThird?.frames[0].fields[0].values.length;

    // Should have the 20 data points in the viz, plus one extra
    expect(storageLengthAfterThirdQuery).toEqual(21);
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
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(false);
  });

  it('mark request as shouldCache', () => {
    const request = mockPromRequest();
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(true);
  });

  it('should not modify the initial request', () => {
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });

    const firstFrames = trimmedFirstPointInPromFrames as unknown as DataFrame[];
    // There are 6 values
    expect(firstFrames[0].fields[1].values.length).toBe(6);
    const expectedValueLength = firstFrames[0].fields[1].values.length;

    const cache = new Map<string, string>();
    const interval = 15000;
    // start time of scenario
    const firstFrom = dateTime(new Date(1726835104488));
    const firstTo = dateTime(new Date(1726836004488));
    const firstRange: TimeRange = {
      from: firstFrom,
      to: firstTo,
      raw: {
        from: 'now-15m',
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

    // we set a bigger interval than query interval
    request.targets[0].interval = '1m';
    const requestInfo: CacheRequestInfo<PromQuery> = {
      requests: [], // unused
      targetSignatures: cache,
      shouldCache: true,
    };
    const targetSignature = `1=1|${interval}|${JSON.stringify(request.rangeRaw ?? '')}`;
    cache.set(targetIdentity, targetSignature);

    const firstQueryResult = storage.procFrames(request, requestInfo, firstFrames);

    expect(firstQueryResult[0].fields[1].values.length).toBe(expectedValueLength);
  });

  it('Should modify request', () => {
    const request = mockPromRequest();
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });
    const cacheRequest = storage.requestInfo(request);
    expect(cacheRequest.requests[0]).toBe(request);
    expect(cacheRequest.shouldCache).toBe(true);
  });

  it('should always use the newest config information', () => {
    const storage = new QueryCache<PromQuery>({
      getTargetSignature: getPrometheusTargetSignature,
      overlapString: '10m',
    });

    // Initial request with custom legend info {{org}}-customLegend
    const firstFrames = differentDisplayNameFromDS.first.dataFrames as unknown as DataFrame[];

    // Second request with legend __auto which results having no displayNameFromDS
    const secondFrames = differentDisplayNameFromDS.second.dataFrames as unknown as DataFrame[];

    const cache = new Map<string, string>();
    const interval = 15000;

    // start time of scenario
    const firstFrom = dateTime(new Date(1726829205000));
    const firstTo = dateTime(new Date(1726829832515));
    const firstRange: TimeRange = {
      from: firstFrom,
      to: firstTo,
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    const secondFrom = dateTime(new Date(1726829220000));
    const secondTo = dateTime(new Date(1726829903931));
    const secondRange: TimeRange = {
      from: secondFrom,
      to: secondTo,
      raw: {
        from: 'now-1h',
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
      app: 'first_app',
    });

    const requestInfo: CacheRequestInfo<PromQuery> = {
      requests: [], // unused
      targetSignatures: cache,
      shouldCache: true,
    };
    const targetSignature = `1=1|${interval}|${JSON.stringify(request.rangeRaw ?? '')}`;
    cache.set(targetIdentity, targetSignature);

    const firstQueryResult = storage.procFrames(request, requestInfo, firstFrames);

    expect(firstQueryResult[0].fields[1].config.displayNameFromDS).toBeDefined();
    expect(firstQueryResult[0].fields[1].config.displayNameFromDS).toEqual('rutgerkerkhoffdevuseast-customLegend');

    const secondQueryResult = storage.procFrames(
      mockPromRequest({
        range: secondRange,
        dashboardUID: dashboardId,
        panelId: panelId,
        app: 'second_app',
      }),
      {
        requests: [], // unused
        targetSignatures: cache,
        shouldCache: true,
      },
      secondFrames
    );

    expect(secondQueryResult[0].fields[1].config.displayNameFromDS).not.toBeDefined();
  });
});

describe('findDataPointStep', () => {
  it('should interpolate custom interval when there is no calculatedMinStep in response', () => {
    const mockApplyInterpolation = jest.fn().mockImplementation(() => '1m');
    const req = mockPromRequest();
    req.targets[0].interval = '$interval';
    const respFrames = trimmedFirstPointInPromFrames as unknown as DataFrame[];
    findDatapointStep(req, respFrames, mockApplyInterpolation);
    expect(mockApplyInterpolation).toBeCalledTimes(1);
  });

  it('should use the calculated minStep coming in response frame', () => {
    const mockApplyInterpolation = jest.fn().mockImplementation(() => '1m');
    const req = mockPromRequest();
    // Cannot be interpolated on frontend as it was calculated on backend.
    req.targets[0].interval = '$__rate_interval';
    const respFrames = trimmedFirstPointInPromFrames as unknown as DataFrame[];
    const expectedMinStep = 60000;
    respFrames[0].meta = {
      custom: {
        calculatedMinStep: expectedMinStep,
      },
    };
    const result = findDatapointStep(req, respFrames, mockApplyInterpolation);
    expect(result).toBe(expectedMinStep);
  });
});
