import { waitFor } from '@testing-library/react';

import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import * as dataSourcesForRulesModule from '../hooks/useDataSourcesForRules';
import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { getAllRulesSourceNames } from '../utils/datasource';

import { fetchAllPromRulesAction } from './actions';

setupMswServer();

describe('fetchAllPromRulesAction', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
    setupDataSources(
      mockDataSource({ uid: 'mimir', name: 'Mimir', jsonData: { manageAlerts: true } }),
      mockDataSource({ uid: 'not-managing', name: 'Not managing', jsonData: { manageAlerts: false } })
    );
  });

  it('fetches the rules of the same rules sources as getAllRulesSourceNames', async () => {
    const store = configureStore();

    await store.dispatch(fetchAllPromRulesAction());

    await waitFor(() =>
      expect(Object.keys(store.getState().unifiedAlerting.promRules).sort()).toEqual(getAllRulesSourceNames().sort())
    );
    expect(Object.keys(store.getState().unifiedAlerting.promRules).sort()).toEqual(['Mimir', 'grafana']);
  });

  it('still fetches the Grafana-managed rules when the rules source list fails', async () => {
    const listSpy = jest
      .spyOn(dataSourcesForRulesModule, 'getDataSourcesForRules')
      .mockRejectedValue(new Error('list failed'));
    const store = configureStore();

    await store.dispatch(fetchAllPromRulesAction());

    await waitFor(() => expect(Object.keys(store.getState().unifiedAlerting.promRules)).toEqual(['grafana']));
    listSpy.mockRestore();
  });
});
