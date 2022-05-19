import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { Provider } from 'react-redux';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, FolderDTO, StoreState } from 'app/types';

import { enableRBAC, mockFolder, mockRulerAlertingRule, mockRulerGrafanaRule } from '../mocks';

import { useFolder } from './useFolder';
import { useIsRuleEditable } from './useIsRuleEditable';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

jest.mock('./useFolder');

const mocks = {
  useFolder: jest.mocked(useFolder),
  useUnifiedAlertingSelector: jest.mocked(useUnifiedAlertingSelector),
};

describe('useIsRuleEditable', () => {
  describe('RBAC enabled', () => {
    enableRBAC();
    describe('Grafana rules', () => {
      it('Should allow editing when the user has the alert rule update permission and folder permissions', () => {
        mockPermissions([AccessControlAction.AlertingRuleUpdate]);
        mockUseFolder({ canSave: true });
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isEditable).toBe(true);
      });

      it('Should allow deleting when the user has the alert rule delete permission and folder permissions', () => {
        mockPermissions([AccessControlAction.AlertingRuleDelete]);
        mockUseFolder({ canSave: true });
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isRemovable).toBe(true);
      });

      it('Should forbid editing when the user has no alert rule update permission and has folder permissions', () => {
        mockPermissions([]);
        mockUseFolder({ canSave: true });
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isEditable).toBe(false);
      });

      it('Should forbid deleting when the user has no alert rule delete permission and has folder permissions', () => {
        mockPermissions([]);
        mockUseFolder({ canSave: true });
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isRemovable).toBe(false);
      });

      it('Should forbid editing and deleting when the user has aler rule permissions but does not have folder permissions', () => {
        mockPermissions([AccessControlAction.AlertingRuleUpdate, AccessControlAction.AlertingRuleDelete]);
        mockUseFolder({ canSave: false });
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('grafana', mockRulerGrafanaRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isEditable).toBe(false);
        expect(result.current.isRemovable).toBe(false);
      });
    });

    describe('Cloud rules', () => {
      beforeEach(() => {
        contextSrv.isEditor = true;
      });

      it('Should allow editing and deleting when the user has alert rule external write permission', () => {
        mockPermissions([AccessControlAction.AlertingRuleExternalWrite]);
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('cortex', mockRulerAlertingRule()), { wrapper });

        expect(result.current.loading).toBe(false);
        expect(result.current.isEditable).toBe(true);
        expect(result.current.isRemovable).toBe(true);
      });

      it('Should forbid editing and deleting when the user has no alert rule external write permission', () => {
        mockPermissions([]);
        const wrapper = getProviderWrapper();

        const { result } = renderHook(() => useIsRuleEditable('cortex', mockRulerAlertingRule()), { wrapper });

        expect(result.current.loading).toBe(false);
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
  const dataSources = getMockedDataSources();
  const store = mockStore({ dataSources });
  const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;
  return wrapper;
}

function getMockedDataSources(): StoreState['unifiedAlerting']['dataSources'] {
  return {
    grafana: {
      loading: false,
      dispatched: false,
      result: {
        id: 'grafana',
        name: 'grafana',
        rulerConfig: { dataSourceName: 'grafana', apiVersion: 'legacy' },
      },
    },
    cortex: {
      loading: false,
      dispatched: false,
      result: {
        id: 'cortex',
        name: 'Cortex',
        rulerConfig: { dataSourceName: 'cortex', apiVersion: 'legacy' },
      },
    },
  };
}

function mockStore(unifiedAlerting?: Partial<StoreState['unifiedAlerting']>) {
  const defaultState = configureStore().getState();

  return configureStore({
    ...defaultState,
    unifiedAlerting: {
      ...defaultState.unifiedAlerting,
      ...unifiedAlerting,
    },
  });
}
