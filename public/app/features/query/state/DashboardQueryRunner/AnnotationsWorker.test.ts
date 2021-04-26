import { throwError } from 'rxjs';
import { setDataSourceSrv } from '@grafana/runtime';

import { AnnotationsWorker } from './AnnotationsWorker';
import * as annotationsSrv from '../../../annotations/annotations_srv';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';

function getTestContext() {
  jest.clearAllMocks();
  const executeAnnotationQueryMock = jest
    .spyOn(annotationsSrv, 'executeAnnotationQuery')
    .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
  const annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
  const dataSourceSrvMock: any = {
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
  };
  setDataSourceSrv(dataSourceSrvMock);
  const options = getDefaultOptions();

  return { options, annotationQueryMock, executeAnnotationQueryMock };
}

describe('AnnotationsWorker', () => {
  const worker = new AnnotationsWorker();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const options = getDefaultOptions();

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called with incorrect props', () => {
    it('then it should return false', () => {
      const dashboard: any = { annotations: { list: [] } };
      const options = { ...getDefaultOptions(), dashboard };

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with incorrect props', () => {
    it('then it should return the correct results', async () => {
      const dashboard: any = { annotations: { list: [] } };
      const options = { ...getDefaultOptions(), dashboard };

      await expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }]);
    });
  });

  describe('when run is called with correct props and all workers are successful', () => {
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({
          alertStates: [],
          annotations: [
            {
              id: 'Legacy',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'Legacy',
              },
              color: 'pink',
              type: 'Test',
              isRegion: false,
            },
            {
              id: 'NextGen',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'NextGen',
              },
              color: 'pink',
              type: 'Test',
              isRegion: false,
            },
          ],
        });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and legacy worker fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
      annotationQueryMock.mockRejectedValue({ message: 'Some error' });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({
          alertStates: [],
          annotations: [
            {
              id: 'NextGen',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'NextGen',
              },
              color: 'pink',
              type: 'Test',
              isRegion: false,
            },
          ],
        });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('when run is called with correct props and nextgen worker fails', () => {
      silenceConsoleOutput();
      it('then it should return the correct results', async () => {
        const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
        executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));

        await expect(worker.work(options)).toEmitValuesWith((received) => {
          expect(received).toHaveLength(1);
          const result = received[0];
          expect(result).toEqual({
            alertStates: [],
            annotations: [
              {
                id: 'Legacy',
                source: {
                  enable: true,
                  hide: false,
                  name: 'Test',
                  iconColor: 'pink',
                  snapshotData: undefined,
                  datasource: 'Legacy',
                },
                color: 'pink',
                type: 'Test',
                isRegion: false,
              },
            ],
          });
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when run is called with correct props and both workers fail', () => {
      silenceConsoleOutput();
      it('then it should return the correct results', async () => {
        const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
        annotationQueryMock.mockRejectedValue({ message: 'Some error' });
        executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));

        await expect(worker.work(options)).toEmitValuesWith((received) => {
          expect(received).toHaveLength(1);
          const result = received[0];
          expect(result).toEqual({ alertStates: [], annotations: [] });
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
