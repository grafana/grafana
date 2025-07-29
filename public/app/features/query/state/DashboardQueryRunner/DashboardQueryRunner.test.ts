import { throwError } from 'rxjs';
import { delay, first } from 'rxjs/operators';

import { AlertState } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import {
  grantUserPermissions,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
} from 'app/features/alerting/unified/mocks';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import * as store from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRulesResponse, PromRuleType } from 'app/types/unified-alerting-dto';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import { backendSrv } from '../../../../core/services/backend_srv';
import * as annotationsSrv from '../../../annotations/executeAnnotationQuery';

import { createDashboardQueryRunner } from './DashboardQueryRunner';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { DashboardQueryRunner, DashboardQueryRunnerResult } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const nameSpaces = [
  mockPromRuleNamespace({
    groups: [
      mockPromRuleGroup({
        name: 'my-group',
        rules: [
          mockPromAlertingRule({
            name: 'my alert',
            state: PromAlertingRuleState.Firing,
            annotations: {
              [Annotation.dashboardUID]: '1',
              [Annotation.panelID]: '1',
            },
          }),
        ],
      }),
      mockPromRuleGroup({
        name: 'another-group',
        rules: [
          mockPromAlertingRule({
            name: 'another alert',
            state: PromAlertingRuleState.Firing,
            annotations: {
              [Annotation.dashboardUID]: '1',
              [Annotation.panelID]: '2',
            },
          }),
        ],
      }),
    ],
  }),
];

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
});

function getTestContext() {
  jest.clearAllMocks();
  const timeSrvMock = { timeRange: jest.fn() } as unknown as TimeSrv;
  const options = getDefaultOptions();
  // These tests are setup so all the workers and runners are invoked once, this wouldn't be the case in real life
  const runner = createDashboardQueryRunner({ dashboard: options.dashboard, timeSrv: timeSrvMock });

  const getResults: PromRulesResponse = {
    status: 'success',
    data: {
      groups: [
        {
          name: 'my-group',
          rules: [
            {
              name: 'my alert',
              state: PromAlertingRuleState.Firing,
              query: 'foo > 1',
              type: PromRuleType.Alerting,
              annotations: {
                [Annotation.dashboardUID]: '1',
                [Annotation.panelID]: '1',
              },
              health: 'ok',
              labels: {},
            },
          ],
          interval: 300,
          file: 'my-namespace',
        },
        {
          name: 'another-group',
          rules: [
            {
              name: 'another alert',
              query: 'foo > 1',
              state: PromAlertingRuleState.Firing,
              type: PromRuleType.Alerting,
              annotations: {
                [Annotation.dashboardUID]: '1',
                [Annotation.panelID]: '2',
              },
              health: 'ok',
              labels: {},
            },
          ],
          interval: 300,
          file: 'my-namespace',
        },
      ],
    },
  };

  const getMock = jest.spyOn(backendSrv, 'get').mockResolvedValue(getResults);
  const executeAnnotationQueryMock = jest
    .spyOn(annotationsSrv, 'executeAnnotationQuery')
    .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
  const annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
  const dataSourceSrvMock = {
    get: async (name: string) => {
      if (name === LEGACY_DS_NAME) {
        return {
          annotationQuery: annotationQueryMock,
        };
      }

      if (name === NEXT_GEN_DS_NAME) {
        return {
          annotations: {},
        };
      }

      return {};
    },
  } as DataSourceSrv;
  setDataSourceSrv(dataSourceSrvMock);
  const dispatchMock = jest.spyOn(store, 'dispatch');

  return { runner, options, annotationQueryMock, executeAnnotationQueryMock, getMock, dispatchMock };
}

function expectOnResults(args: {
  runner: DashboardQueryRunner;
  panelId: number;
  done: jest.DoneCallback;
  expect: (results: DashboardQueryRunnerResult) => void;
}) {
  const { runner, done, panelId, expect: expectCallback } = args;
  runner
    .getResult(panelId)
    .pipe(first())
    .subscribe({
      next: (value) => {
        try {
          expectCallback(value);
          done();
        } catch (err) {
          done(err);
        }
      },
    });
}

describe('DashboardQueryRunnerImpl', () => {
  describe('when calling run and all workers succeed', () => {
    it('then it should return the correct results', (done) => {
      const { dispatchMock, runner, options, annotationQueryMock, executeAnnotationQueryMock } = getTestContext();
      dispatchMock.mockResolvedValue({ data: nameSpaces });

      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          expect(results).toEqual(getExpectedForAllResult());
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          expect(dispatchMock).toHaveBeenCalledTimes(1);
        },
      });

      runner.run(options);
    });
  });

  describe('when calling run and all workers succeed but take longer than 200ms', () => {
    it('then it should return the empty results', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      const wait = 201;
      executeAnnotationQueryMock.mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(wait)));
      dispatchMock.mockResolvedValue({ data: nameSpaces });
      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          expect(results).toEqual({ annotations: [] });
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          expect(dispatchMock).toHaveBeenCalledTimes(1);
        },
      });

      runner.run(options);
    });
  });

  describe('when calling run and all workers succeed but the subscriber subscribes after the run', () => {
    it('then it should return the last results', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ data: nameSpaces });
      runner.run(options);

      setTimeout(
        () =>
          expectOnResults({
            runner,
            panelId: 1,
            done,
            expect: (results) => {
              // should have one alert state, one snapshot, one legacy and one next gen result
              // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
              expect(results).toEqual(getExpectedForAllResult());
              expect(annotationQueryMock).toHaveBeenCalledTimes(1);
              expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
              expect(dispatchMock).toHaveBeenCalledTimes(1);
            },
          }),
        200
      ); // faking a late subscriber to make sure we get the latest results
    });
  });

  describe('when calling run and all workers fail', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ error: { message: 'Get error' } });
      annotationQueryMock.mockRejectedValue({ message: 'Legacy error' });
      executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'NextGen error' }));

      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          const expected = { alertState: undefined, annotations: [getExpectedForAllResult().annotations[2]] };
          expect(results).toEqual(expected);
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        },
      });

      runner.run(options);
    });
  });

  describe('when calling run and AlertStatesWorker fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ message: 'Get error' });

      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          const { annotations } = getExpectedForAllResult();
          const expected = { alertState: undefined, annotations };
          expect(results).toEqual(expected);
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        },
      });

      runner.run(options);
    });

    describe('when calling run and AnnotationsWorker fails', () => {
      silenceConsoleOutput();
      it('then it should return the correct results', (done) => {
        const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
        dispatchMock.mockResolvedValue({ data: nameSpaces });
        annotationQueryMock.mockRejectedValue({ message: 'Legacy error' });
        executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'NextGen error' }));

        expectOnResults({
          runner,
          panelId: 1,
          done,
          expect: (results) => {
            // should have one alert state, one snapshot, one legacy and one next gen result
            // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
            const { alertState, annotations } = getExpectedForAllResult();
            const expected = { alertState, annotations: [annotations[2]] };
            expect(results).toEqual(expected);
            expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          },
        });

        runner.run(options);
      });
    });
  });

  describe('when calling run twice', () => {
    it('then it should cancel previous run', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ data: nameSpaces });
      executeAnnotationQueryMock.mockReturnValueOnce(
        toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000))
      );

      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          const { alertState, annotations } = getExpectedForAllResult();
          const expected = { alertState, annotations };
          expect(results).toEqual(expected);
          expect(annotationQueryMock).toHaveBeenCalledTimes(2);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(2);
          expect(dispatchMock).toHaveBeenCalledTimes(2);
        },
      });

      runner.run(options);
      runner.run(options);
    });
  });

  describe('when calling cancel', () => {
    it('then it should cancel matching workers', (done) => {
      const { runner, options, annotationQueryMock, executeAnnotationQueryMock, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ data: nameSpaces });
      executeAnnotationQueryMock.mockReturnValueOnce(
        toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000))
      );

      expectOnResults({
        runner,
        panelId: 1,
        done,
        expect: (results) => {
          // should have one alert state, one snapshot, one legacy and one next gen result
          // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
          const { alertState, annotations } = getExpectedForAllResult();
          expect(results).toEqual({ alertState, annotations: [annotations[0], annotations[2]] });
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        },
      });

      runner.run(options);
      setTimeout(() => {
        // call to async needs to be async or the cancellation will be called before any of the workers have started
        runner.cancel(options.dashboard.annotations.list[1]);
      }, 100);
    });
  });
});

function getExpectedForAllResult(): DashboardQueryRunnerResult {
  return {
    alertState: {
      dashboardId: 1,
      id: 0,
      panelId: 1,
      state: AlertState.Alerting,
    },
    annotations: [
      {
        color: '#ffc0cb',
        id: 'Legacy',
        isRegion: false,
        source: {
          datasource: 'Legacy',
          enable: true,
          hide: false,
          iconColor: 'pink',
          id: undefined,
          name: 'Test',
          snapshotData: undefined,
        },
        type: 'Test',
      },
      {
        color: '#ffc0cb',
        id: 'NextGen',
        isRegion: false,
        source: {
          datasource: 'NextGen',
          enable: true,
          hide: false,
          iconColor: 'pink',
          id: undefined,
          name: 'Test',
          snapshotData: undefined,
        },
        type: 'Test',
      },
      {
        annotation: {
          datasource: 'Legacy',
          enable: true,
          hide: false,
          iconColor: 'pink',
          id: 'Snapshotted',
          name: 'Test',
        },
        color: '#ffc0cb',
        isRegion: true,
        source: {
          datasource: 'Legacy',
          enable: true,
          hide: false,
          iconColor: 'pink',
          id: 'Snapshotted',
          name: 'Test',
        },
        time: 1,
        timeEnd: 2,
        type: 'Test',
      },
    ],
  };
}
