import moment from 'moment';

import { DataFrame, DataQueryRequest, DateTime, dateTime, TimeRange } from '@grafana/data/src';

import { QueryCache } from '../QueryCache';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { PromQuery } from '../types';

import { IncrementalStorageDataFrameScenarios } from './PrometheusIncrementalStorageTestData';

const mockRequest = (request?: Partial<DataQueryRequest<PromQuery>>): DataQueryRequest<PromQuery> => {
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
        requestId: '2A',
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

describe('PrometheusIncrementalStorage', function () {
  it('instantiates', () => {
    const storage = new QueryCache();
    expect(storage).toBeInstanceOf(QueryCache);
  });

  it('Merges incremental queries in storage', () => {
    const scenarios = [
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtEnd(),
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapInMiddle(),
      IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtStart(),
    ];

    scenarios.forEach((scenario, index) => {
      const storage = new QueryCache();
      const firstFrames = scenario.first.dataFrames as unknown as DataFrame[];
      const secondFrames = scenario.second.dataFrames as unknown as DataFrame[];
      const targetSignifiers = new Map<string, string>();

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
      const secondFrom = dateTime(new Date(1675262550000 + 1000 * 60 * 2));
      const secondTo = dateTime(new Date(1675262550000 + 1000 * 60 * 2)).add(6, 'hours');

      const secondRange: TimeRange = {
        from: secondFrom,
        to: secondTo,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      };

      const frameSignifier = `helloFrameSig--${index}`;
      const dashboardId = `dashid--${index}`;
      const panelId = 2 + index;
      const targetSignifier = `${dashboardId}|${panelId}|A`;
      const firstFramesLength = firstFrames[0].fields[0].values.length;

      targetSignifiers.set(targetSignifier, frameSignifier);

      const firstStoredFrames = storage.procFrames(
        mockRequest({
          range: firstRange,
          dashboardUID: dashboardId,
          panelId: panelId,
        }),
        {
          requests: [], // unused
          targSigs: targetSignifiers,
          shouldCache: true,
        },
        firstFrames
      );

      // const storageLengthAfterInitialQuery = storage.cache.get(targetSignifier);

      // Failing assertion for multiple scenarios, but always passes the first one? - WIP
      // I would expect that the number of values received from the API should be the same as the cached values?
      // expect(storageLengthAfterInitialQuery?.frames[0].fields[0].values.length).toEqual(firstFramesLength);

      expect(firstStoredFrames).toEqual(firstFrames);

      const secondStoredFrames = storage.procFrames(
        mockRequest({
          range: secondRange,
          dashboardUID: dashboardId,
          panelId: panelId,
        }),
        {
          requests: [], // unused
          targSigs: targetSignifiers,
          shouldCache: true,
        },
        secondFrames
      );

      const secondFramesLength = secondFrames[0].fields[0].values.length;

      const storageLengthAfterSubsequentQuery = storage.cache.get(targetSignifier);

      // Failing assertions: the frames are not square!
      expect(storageLengthAfterSubsequentQuery?.frames[0].fields[0].values.length).toEqual(
        storageLengthAfterSubsequentQuery?.frames[0].fields[1].values.length
      );
      expect(storageLengthAfterSubsequentQuery?.frames[1].fields[0].values.length).toEqual(
        storageLengthAfterSubsequentQuery?.frames[1].fields[1].values.length
      );

      // WIP
      // we should have stored the total number of frames received, minus the 10 minute overlap (20 values) and the one extra frame knocked off the start
      // expect(storageLengthAfterSubsequentQuery?.frames[0].fields[0].values.length).toEqual((secondFramesLength + firstFramesLength) - 20 - 1);
      // expect(storageLengthAfterSubsequentQuery?.frames[1].fields[0].values.length).toEqual((secondFramesLength + firstFramesLength) - 20 - 1);

      // first frames stored should be bigger then the incremental
      expect(firstFramesLength).toBeGreaterThan(secondFramesLength);

      // All of the new values should be the ones that were stored
      secondFrames[0].fields[0].values.toArray().forEach((secondRequestValue) => {
        expect(secondStoredFrames[0].fields[0].values).toContain(secondRequestValue);
      });

      secondFrames[0].fields[1].values.toArray().forEach((secondRequestValue) => {
        expect(secondStoredFrames[0].fields[1].values).toContain(secondRequestValue);
      });

      secondFrames[1].fields[0].values.toArray().forEach((secondRequestValue) => {
        expect(secondStoredFrames[1].fields[0].values).toContain(secondRequestValue);
      });

      secondFrames[1].fields[1].values.toArray().forEach((secondRequestValue) => {
        expect(secondStoredFrames[1].fields[1].values).toContain(secondRequestValue);
      });
    });
  });

  //
  // it('Will not alter existing data when there are multiple series with missing data', () => {
  //   const storage = new IncrementalStorage(getDatasourceStub(), defaultOptions);
  //   const intervalMs = 30000;
  //
  //   const scenarios = [
  //     IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtEnd(),
  //     IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapInMiddle(),
  //     IncrementalStorageDataFrameScenarios.histogram.getSeriesWithGapAtStart(),
  //   ];
  //   scenarios.forEach((scenario) => {
  //     const firstRequest = scenario.first;
  //     const secondRequest = scenario.second;
  //
  //     const firstDataFrameResponse: DataQueryResponse = {
  //       data: firstRequest.dataFrames.map((frame) => toDataFrame(frame)),
  //     };
  //     const secondDataFrameResponse: DataQueryResponse = {
  //       data: secondRequest.dataFrames.map((frame) => toDataFrame(frame)),
  //     };
  //
  //     const firstDataFrames = storage.appendQueryResultToDataFrameStorage(
  //       firstRequest.request as unknown as DataQueryRequest<PromQuery>,
  //       firstDataFrameResponse,
  //       firstRequest.originalRange
  //     );
  //
  //     // Since we are missing values in these series, the preprocessing should add a few null values
  //     expect(firstDataFrames.data[0].fields[0].values.toArray().length).toBeGreaterThan(
  //       firstRequest.dataFrames[0].fields[0].values.length
  //     );
  //
  //     const firstMergedLength = firstDataFrames.data[0].fields[0].values.length;
  //
  //     const secondDataFrames = storage.appendQueryResultToDataFrameStorage(
  //       secondRequest.request as unknown as DataQueryRequest<PromQuery>,
  //       secondDataFrameResponse,
  //       secondRequest.originalRange
  //     );
  //
  //     const secondMergedLength = secondDataFrames.data[0].fields[0].values.length;
  //
  //     expect(firstMergedLength).toEqual(secondMergedLength);
  //     // expect(secondDataFrames.data[0].fields[1].values.toArray()).toContain(firstDataFrames.data[0].fields[1].values.toArray())
  //     // I expect the original response to contain everything that's returned by the second merged response, expect for first and last few values
  //     const valuesFromFirstResponseWithoutFirstValue: number[] = firstDataFrames.data[0].fields[1].values.toArray();
  //     const valuesMergedAfterSecondResponse: number[] = secondDataFrames.data[0].fields[1].values.toArray();
  //
  //     valuesFromFirstResponseWithoutFirstValue.forEach((value, index) => {
  //       // Skip the first 3 values
  //       if (index > 2) {
  //         expect(valuesMergedAfterSecondResponse).toContain(value);
  //       }
  //     });
  //
  //     const timeDeltasFirstRequest: number[] = firstDataFrames.data[0].fields[0].values
  //       .toArray()
  //       .map((v: number, i: number, a: number[]) => v - (a[i - 1] ?? 0));
  //     // remove the first element of the delta array, it's just the value of the first element: not needed
  //     timeDeltasFirstRequest.shift();
  //
  //     const timeDeltasSecondRequest: number[] = secondDataFrames.data[0].fields[0].values
  //       .toArray()
  //       .map((v: number, i: number, a: number[]) => v - (a[i - 1] ?? 0));
  //
  //     timeDeltasSecondRequest.shift();
  //
  //     // Assert that the difference between each time value is always the interval
  //     const gapsInFirstRequest = timeDeltasFirstRequest.filter((value) => value !== intervalMs);
  //     const gapsInSecondRequest = timeDeltasSecondRequest.filter((value) => value !== intervalMs);
  //     expect(gapsInFirstRequest).toEqual(gapsInSecondRequest);
  //   });
  // });
  //
  // it('Will evict old dataframes, and use stored data when user shortens query window', () => {
  //   const storage = new IncrementalStorage(getDatasourceStub(), defaultOptions);
  //
  //   // Initial request with all data for time range
  //   const firstRequest = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.first;
  //
  //   // Shortened request 30s later
  //   const secondRequest = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.second;
  //
  //   // Now the user waits a minute and changes the query duration to just the last 5 minutes, luckily the interval hasn't changed, so we can still use the data in storage except for the latest minute
  //   const thirdRequest = IncrementalStorageDataFrameScenarios.histogram.evictionRequests.third;
  //
  //   const firstDataFrameResponse: DataQueryResponse = { data: [toDataFrame(firstRequest.dataFrame)] };
  //   const secondDataFrameResponse: DataQueryResponse = { data: [toDataFrame(secondRequest.dataFrame)] };
  //   const thirdDataFrameResponse: DataQueryResponse = { data: [toDataFrame(thirdRequest.dataFrame)] };
  //
  //   const firstDataFrames = storage.appendQueryResultToDataFrameStorage(
  //     firstRequest.request as unknown as DataQueryRequest<PromQuery>,
  //     firstDataFrameResponse,
  //     firstRequest.originalRange
  //   );
  //   const firstMergedLength = firstDataFrames.data[0].fields[0].values.length;
  //
  //   const secondDataFrames = storage.appendQueryResultToDataFrameStorage(
  //     secondRequest.request as unknown as DataQueryRequest<PromQuery>,
  //     secondDataFrameResponse,
  //     secondRequest.originalRange
  //   );
  //   const secondMergedLength = secondDataFrames.data[0].fields[0].values.length;
  //   const storageLengthAfterSecondQuery = Object.values(storage.getStorage())[0]['__time__'].length;
  //
  //   // Since the step is 15s, and the request was 30 seconds later, we should have 2 extra frames, but we should evict the first two, so we should get the same length
  //   expect(firstMergedLength).toEqual(secondMergedLength);
  //   expect(firstDataFrames.data[0].fields[0].values.toArray()[2]).toEqual(
  //     secondDataFrames.data[0].fields[0].values.toArray()[0]
  //   );
  //   expect(firstDataFrames.data[0].fields[0].values.toArray()[0] + 30000).toEqual(
  //     secondDataFrames.data[0].fields[0].values.toArray()[0]
  //   );
  //
  //   storage.appendQueryResultToDataFrameStorage(
  //     thirdRequest.request as unknown as DataQueryRequest<PromQuery>,
  //     thirdDataFrameResponse,
  //     thirdRequest.originalRange
  //   );
  //   const storageLengthAfterThirdQuery = Object.values(storage.getStorage())[0]['__time__'].length;
  //   expect(storageLengthAfterSecondQuery).toBeGreaterThan(storageLengthAfterThirdQuery);
  // });
  //
  // it('Avoids off by one error', () => {
  //   const storage = new IncrementalStorage(getDatasourceStub(), defaultOptions);
  //
  //   const firstRequest = IncrementalStorageDataFrameScenarios.histogram.noEvictionRequests.first;
  //   const secondRequest = IncrementalStorageDataFrameScenarios.histogram.noEvictionRequests.second;
  //   const thirdRequest = IncrementalStorageDataFrameScenarios.histogram.noEvictionRequests.third;
  //
  //   const firstDataFrameResponse: DataQueryResponse = { data: [toDataFrame(firstRequest.dataFrame)] };
  //   const secondDataFrameResponse: DataQueryResponse = { data: [toDataFrame(secondRequest.dataFrame)] };
  //   const thirdDataFrameResponse: DataQueryResponse = { data: [toDataFrame(thirdRequest.dataFrame)] };
  //
  //   // Our first query should just prime the cache, and return unaltered data frames
  //   const firstDataFrames = storage.appendQueryResultToDataFrameStorage(
  //     mockRequest(firstRequest.request as DataQueryRequest<PromQuery>),
  //     firstDataFrameResponse,
  //     firstRequest.originalRange
  //   );
  //
  //   // Should be unchanged...
  //   expect(JSON.stringify(firstDataFrames)).toEqual(JSON.stringify({ data: [toDataFrame(firstRequest.dataFrame)] }));
  //
  //   // and the same object in memory
  //   expect(firstDataFrames).toBe(firstDataFrameResponse);
  //
  //   const firstRequestLength = firstRequest.dataFrame.fields[0].values.length;
  //   const firstMergedLength = firstDataFrames.data[0].fields[0].values.length;
  //   expect(firstRequestLength).toEqual(firstMergedLength);
  //
  //   // Now the second query we get is just for a few seconds later, without prometheus storage we'd have to ask prometheus for the entire set of data again!
  //   // But since we have the frames from the last request stored, we were able to modify the request to the backend to exclude data the client already has available
  //   // So this request was much smaller than the first one!
  //   // But now we have the arduous task of merging the new frames from the response with the ones we have in storage.
  //   // A few things to note here, we provide an overlap duration in this class PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS,
  //   // which adds a bit of overhead to these requests, but trends towards eventual consistency:
  //   //  prom records can be inconsistent from the last 10 minutes in some instances
  //
  //   const secondDataFrames = storage.appendQueryResultToDataFrameStorage(
  //     mockRequest(secondRequest.request as DataQueryRequest<PromQuery>),
  //     secondDataFrameResponse,
  //     secondRequest.originalRange
  //   );
  //
  //   // Should still be same object
  //   expect(secondDataFrames).toBe(secondDataFrameResponse);
  //
  //   // But since we stitched frames from storage into the response, this dataframe should be a bit longer or equal, as long as the original query duration doesn't begin after existing frames
  //   // To keep the frame from getting evicted we're using a request that has a huge original request duration, so everything is kept in storage indefinitely for the purpose of this test
  //   const secondRequestLength = secondRequest.dataFrame.fields[0].values.length;
  //   const secondMergedLength = secondDataFrames.data[0].fields[0].values.length;
  //   expect(secondRequestLength).toBeLessThanOrEqual(secondMergedLength);
  //   expect(secondMergedLength).toBe(firstRequestLength + 1);
  //
  //   const thirdDataFrames = storage.appendQueryResultToDataFrameStorage(
  //     mockRequest(thirdRequest.request as DataQueryRequest<PromQuery>),
  //     thirdDataFrameResponse,
  //     thirdRequest.originalRange
  //   );
  //
  //   // STILL the same object
  //   expect(thirdDataFrames).toBe(thirdDataFrameResponse);
  //
  //   const thirdRequestLength = thirdRequest.dataFrame.fields[0].values.length;
  //   const thirdMergedLength = thirdDataFrames.data[0].fields[0].values.length;
  //
  //   // request should be smaller then dataframe returned to viz
  //   expect(thirdRequestLength).toBeLessThan(thirdMergedLength);
  //
  //   // Both of the subsequent requests should be smaller
  //   expect(thirdRequestLength).toBeLessThan(firstRequestLength);
  //   expect(secondRequestLength).toBeLessThan(firstRequestLength);
  //
  //   // But the second and third had the same number of
  //   expect(thirdRequestLength).toEqual(secondRequestLength);
  //
  //   expect((firstMergedLength === secondMergedLength) === thirdMergedLength);
  // });
});
