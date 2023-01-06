import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';

import { RuleDetails } from './RuleDetails';

jest.mock('../../hooks/useIsRuleEditable');

const mocks = {
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    delete: byRole('button', { name: /delete/i }),
    silence: byRole('link', { name: 'Silence' }),
  },
};

jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(true);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users with the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });

    it('Should not render Silence button for users wihout the instance create permission', () => {
      // Arrange
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
    });

    it('Should render Silence button for users with the instance create permissions', () => {
      // Arrange
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.silence.query()).toBeInTheDocument();
    });
  });
  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' });

    it('Should not render Edit button for users with the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });
  });
});

function renderRuleDetails(rule: CombinedRule) {
  const store = configureStore();

  render(
    <Provider store={store}>
      <MemoryRouter>
        <RuleDetails rule={rule} />
      </MemoryRouter>
    </Provider>
  );
}
