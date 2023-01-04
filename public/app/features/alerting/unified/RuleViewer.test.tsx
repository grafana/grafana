import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { RuleViewer } from './RuleViewer';
import { useCombinedRule } from './hooks/useCombinedRule';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from './mocks';

const mockGrafanaRule = getGrafanaRule({ name: 'Test alert' });
const mockCloudRule = getCloudRule({ name: 'cloud test alert' });
const mockRoute: GrafanaRouteComponentProps<{ id?: string; sourceName?: string }> = {
  route: {
    path: '/',
    component: RuleViewer,
  },
  queryParams: { returnTo: '/alerting/list' },
  match: { params: { id: 'test1', sourceName: 'grafana' }, isExact: false, url: 'asdf', path: '' },
  history: locationService.getHistory(),
  location: { pathname: '', hash: '', search: '', state: '' },
  staticContext: {},
};

jest.mock('./hooks/useCombinedRule');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => ({ name: 'prometheus' }),
      get: () =>
        Promise.resolve({
          filterQuery: () => true,
        }),
    };
  },
}));

const store = configureStore();
const renderRuleViewer = () => {
  return act(async () => {
    render(
      <Provider store={store}>
        <Router history={locationService.getHistory()}>
          <RuleViewer {...mockRoute} />
        </Router>
      </Provider>
    );
  });
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    delete: byRole('button', { name: /delete/i }),
    silence: byRole('link', { name: 'Silence' }),
  },
};
jest.mock('./hooks/useIsRuleEditable');

const mocks = {
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

describe('RuleViewer', () => {
  let mockCombinedRule: jest.MockedFn<typeof useCombinedRule>;

  beforeEach(() => {
    mockCombinedRule = jest.mocked(useCombinedRule);
  });

  afterEach(() => {
    mockCombinedRule.mockReset();
  });

  it('should render page with grafana alert', async () => {
    mockCombinedRule.mockReturnValue({
      result: mockGrafanaRule as CombinedRule,
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });
    mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
    await renderRuleViewer();

    expect(screen.getByText(/view rule/i)).toBeInTheDocument();
    expect(screen.getByText(/test alert/i)).toBeInTheDocument();
  });

  it('should render page with cloud alert', async () => {
    mockCombinedRule.mockReturnValue({
      result: mockCloudRule as CombinedRule,
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });
    mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
    await renderRuleViewer();
    expect(screen.getByText(/view rule/i)).toBeInTheDocument();
    expect(screen.getByText(/cloud test alert/i)).toBeInTheDocument();
  });
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    let mockCombinedRule: jest.MockedFn<typeof useCombinedRule>;

    beforeEach(() => {
      mockCombinedRule = jest.mocked(useCombinedRule);
    });

    afterEach(() => {
      mockCombinedRule.mockReset();
    });
    it('Should render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.edit.get()).toBeInTheDocument();
    });

    it('Should  render Delete button for users with the delete permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.delete.get()).toBeInTheDocument();
    });

    it('Should not render Silence button for users wihout the instance create permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
    });

    it('Should render Silence button for users with the instance create permissions', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.silence.query()).toBeInTheDocument();
    });
  });
  describe('Cloud rules action buttons', () => {
    let mockCombinedRule: jest.MockedFn<typeof useCombinedRule>;

    beforeEach(() => {
      mockCombinedRule = jest.mocked(useCombinedRule);
    });

    afterEach(() => {
      mockCombinedRule.mockReset();
    });
    it('Should render edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
    });
  });
});
