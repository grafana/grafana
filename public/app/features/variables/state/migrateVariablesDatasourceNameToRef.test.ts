import { migrateVariablesDatasourceNameToRef } from './actions';
import { adHocBuilder, queryBuilder } from '../shared/testing/builders';
import { DataSourceRef } from '@grafana/data/src';
import { changeVariableProp } from './sharedReducer';
import { toVariablePayload } from './types';

function getTestContext(ds: DataSourceRef, dsInstance?: { uid: string; type: string }) {
  jest.clearAllMocks();
  const query = queryBuilder().withId('query').withName('query').withDatasource(ds).build();
  const adhoc = adHocBuilder().withId('adhoc').withName('adhoc').withDatasource(ds).build();
  const state = { templating: { variables: [query, adhoc] } };
  const dispatch = jest.fn();
  const getState = jest.fn().mockReturnValue(state);
  const getInstanceSettingsMock = jest.fn().mockReturnValue(dsInstance);
  const getDatasourceSrvFunc = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn().mockReturnValue([]),
    getInstanceSettings: getInstanceSettingsMock,
  });

  return { query, adhoc, dispatch, getState, getDatasourceSrvFunc };
}

describe('migrateVariablesDatasourceNameToRef', () => {
  describe('when called and variables have legacy data source props', () => {
    describe('and data source exists', () => {
      it('then correct actions are dispatched', async () => {
        const legacyDs = ('${ds}' as unknown) as DataSourceRef;
        const { query, adhoc, dispatch, getState, getDatasourceSrvFunc } = getTestContext(legacyDs, {
          uid: 'a random uid',
          type: 'prometheus',
        });

        migrateVariablesDatasourceNameToRef(getDatasourceSrvFunc)(dispatch, getState, undefined);

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0][0]).toEqual(
          changeVariableProp(
            toVariablePayload(query, { propName: 'datasource', propValue: { uid: 'a random uid', type: 'prometheus' } })
          )
        );
        expect(dispatch.mock.calls[1][0]).toEqual(
          changeVariableProp(
            toVariablePayload(adhoc, { propName: 'datasource', propValue: { uid: 'a random uid', type: 'prometheus' } })
          )
        );
      });
    });

    describe('and data source does not exist', () => {
      it('then correct actions are dispatched', async () => {
        const legacyDs = ('${ds}' as unknown) as DataSourceRef;
        const { query, adhoc, dispatch, getState, getDatasourceSrvFunc } = getTestContext(legacyDs, undefined);

        migrateVariablesDatasourceNameToRef(getDatasourceSrvFunc)(dispatch, getState, undefined);

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0][0]).toEqual(
          changeVariableProp(toVariablePayload(query, { propName: 'datasource', propValue: { uid: '${ds}' } }))
        );
        expect(dispatch.mock.calls[1][0]).toEqual(
          changeVariableProp(toVariablePayload(adhoc, { propName: 'datasource', propValue: { uid: '${ds}' } }))
        );
      });
    });
  });

  describe('when called and variables have dataSourceRef', () => {
    it('then no actions are dispatched', async () => {
      const legacyDs = { uid: '${ds}', type: 'prometheus' };
      const { dispatch, getState, getDatasourceSrvFunc } = getTestContext(legacyDs, undefined);

      migrateVariablesDatasourceNameToRef(getDatasourceSrvFunc)(dispatch, getState, undefined);

      expect(dispatch).toHaveBeenCalledTimes(0);
    });
  });
});
