import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { CombinedRule } from 'app/types/unified-alerting';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';

import { RulesTable } from './RulesTable';

jest.mock('../../hooks/useIsRuleEditable');

const mocks = {
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: 'Edit' }),
    view: byRole('link', { name: 'View' }),
    delete: byRole('button', { name: 'Delete' }),
  },
};

jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(true);

function renderRulesTable(rule: CombinedRule) {
  const store = configureStore();

  render(
    <Provider store={store}>
      <MemoryRouter>
        <RulesTable rules={[rule]} />
      </MemoryRouter>
    </Provider>
  );
}

describe('RulesTable RBAC', () => {
  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });
    it('Should not render Edit button for users without the update permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
      renderRulesTable(grafanaRule);
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users without the delete permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: false });
      renderRulesTable(grafanaRule);
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      renderRulesTable(grafanaRule);
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });
      renderRulesTable(grafanaRule);
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
    });
  });

  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' });
    it('Should not render Edit button for users without the update permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
      renderRulesTable(cloudRule);
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users without the delete permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: false });
      renderRulesTable(cloudRule);
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      renderRulesTable(cloudRule);
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });
      renderRulesTable(cloudRule);
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
    });
  });
});
