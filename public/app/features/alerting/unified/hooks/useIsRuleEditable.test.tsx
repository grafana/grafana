import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Provider } from 'react-redux';

import { contextSrv } from 'app/core/services/context_srv';
import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, FolderDTO } from 'app/types';

import { setupMswServer } from '../mockApi';
import { mockDataSource, mockFolder, mockRulerAlertingRule, mockRulerGrafanaRule } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import { useFolder } from './useFolder';
import { useIsRuleEditable } from './useIsRuleEditable';

jest.mock('./useFolder');

const mocks = {
  useFolder: jest.mocked(useFolder),
};

setupMswServer();

const dataSources = {
  mimir: mockDataSource({ uid: MIMIR_DATASOURCE_UID, name: 'Mimir' }),
};

setupDataSources(dataSources.mimir);

describe('useIsRuleEditable', () => {
  describe('RBAC enabled', () => {
    describe('Grafana rules', () => {
      // When RBAC is enabled we require appropriate alerting permissions in the folder scope
      it('Should allow editing when the user has the alert rule update permission in the folder', async () => {
        mockUseFolder({
          accessControl: {
            [AccessControlAction.AlertingRuleUpdate]: true,
          },
        });

        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isEditable).toBe(true);
      });

      it('Should allow deleting when the user has the alert rule delete permission', async () => {
        mockUseFolder({
          accessControl: {
            [AccessControlAction.AlertingRuleDelete]: true,
          },
        });

        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isRemovable).toBe(true);
      });

      it('Should forbid editing when the user has no alert rule update permission', async () => {
        mockUseFolder({ accessControl: {} });

        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isEditable).toBe(false);
      });

      it('Should forbid deleting when the user has no alert rule delete permission', async () => {
        mockUseFolder({ accessControl: {} });

        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isRemovable).toBe(false);
      });

      it('Should allow editing and deleting when the user has alert rule permissions but does not have folder canSave permission', async () => {
        mockUseFolder({
          canSave: false,
          accessControl: {
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.AlertingRuleDelete]: true,
          },
        });

        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isEditable).toBe(true);
        expect(result.current.isRemovable).toBe(true);
      });
    });

    describe('Cloud rules', () => {
      beforeEach(() => {
        mocks.useFolder.mockReturnValue({ loading: false });
        contextSrv.isEditor = true;
      });

      it('Should allow editing and deleting when the user has alert rule external write permission', async () => {
        mockPermissions([AccessControlAction.AlertingRuleExternalWrite]);
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable(dataSources.mimir.name, mockRulerAlertingRule()), {
          wrapper,
        });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isEditable).toBe(true);
        expect(result.current.isRemovable).toBe(true);
      });

      it('Should forbid editing and deleting when the user has no alert rule external write permission', async () => {
        mockPermissions([]);
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable(dataSources.mimir.name, mockRulerAlertingRule()), {
          wrapper,
        });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.isEditable).toBe(false);
        expect(result.current.isRemovable).toBe(false);
      });
    });
  });
});

function mockUseFolder(partial?: Partial<FolderDTO>) {
  mocks.useFolder.mockReturnValue({ loading: false, folder: mockFolder(partial) });
}

function mockPermissions(grantedPermissions: AccessControlAction[]) {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action) => grantedPermissions.includes(action as AccessControlAction));
}

function getProviderWrapper() {
  const store = configureStore();
  const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
  return wrapper;
}
