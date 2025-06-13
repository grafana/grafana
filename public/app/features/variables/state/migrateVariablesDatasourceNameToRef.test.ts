import { DataSourceRef } from '@grafana/data';

import { adHocBuilder, queryBuilder } from '../shared/testing/builders';
import { toVariablePayload } from '../utils';

import { migrateVariablesDatasourceNameToRef } from './actions';
import { getPreloadedState } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import { changeVariableProp } from './sharedReducer';

function getTestContext(ds: DataSourceRef, dsInstance?: { uid: string; type: string }) {
  jest.clearAllMocks();
  const key = 'key';
  const query = queryBuilder().withId('query').withRootStateKey(key).withName('query').withDatasource(ds).build();
  const adhoc = adHocBuilder().withId('adhoc').withRootStateKey(key).withName('adhoc').withDatasource(ds).build();
  const templatingState = { variables: { query, adhoc } };
  const state = getPreloadedState(key, templatingState);
  const dispatch = jest.fn();
  const getState = jest.fn().mockReturnValue(state);
  const getInstanceSettingsMock = jest.fn().mockReturnValue(dsInstance);
  const getDatasourceSrvFunc = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn().mockReturnValue([]),
    getInstanceSettings: getInstanceSettingsMock,
  });

  return { key, query, adhoc, dispatch, getState, getDatasourceSrvFunc };
}

describe('migrateVariablesDatasourceNameToRef', () => {
  describe('when called and variables have legacy data source props', () => {
    describe('and data source exists', () => {
      it('then correct actions are dispatched', async () => {
        const legacyDs = '${ds}' as unknown as DataSourceRef;
        const { query, adhoc, dispatch, getState, getDatasourceSrvFunc, key } = getTestContext(legacyDs, {
          uid: 'a random uid',
          type: 'prometheus',
        });

        migrateVariablesDatasourceNameToRef(key, getDatasourceSrvFunc)(dispatch, getState, undefined);

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0][0]).toEqual(
          toKeyedAction(
            key,
            changeVariableProp(
              toVariablePayload(query, {
                propName: 'datasource',
                propValue: { uid: 'a random uid', type: 'prometheus' },
              })
            )
          )
        );
        expect(dispatch.mock.calls[1][0]).toEqual(
          toKeyedAction(
            key,
            changeVariableProp(
              toVariablePayload(adhoc, {
                propName: 'datasource',
                propValue: { uid: 'a random uid', type: 'prometheus' },
              })
            )
          )
        );
      });
    });

    describe('and data source does not exist', () => {
      it('then correct actions are dispatched', async () => {
        const legacyDs = '${ds}' as unknown as DataSourceRef;
        const { query, adhoc, dispatch, getState, getDatasourceSrvFunc, key } = getTestContext(legacyDs, undefined);

        migrateVariablesDatasourceNameToRef(key, getDatasourceSrvFunc)(dispatch, getState, undefined);

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0][0]).toEqual(
          toKeyedAction(
            key,
            changeVariableProp(toVariablePayload(query, { propName: 'datasource', propValue: { uid: '${ds}' } }))
          )
        );
        expect(dispatch.mock.calls[1][0]).toEqual(
          toKeyedAction(
            key,
            changeVariableProp(toVariablePayload(adhoc, { propName: 'datasource', propValue: { uid: '${ds}' } }))
          )
        );
      });
    });
  });

  describe('when called and variables have dataSourceRef', () => {
    it('then no actions are dispatched', async () => {
      const legacyDs = { uid: '${ds}', type: 'prometheus' };
      const { dispatch, getState, getDatasourceSrvFunc, key } = getTestContext(legacyDs, undefined);

      migrateVariablesDatasourceNameToRef(key, getDatasourceSrvFunc)(dispatch, getState, undefined);

      expect(dispatch).toHaveBeenCalledTimes(0);
    });
  });
});
