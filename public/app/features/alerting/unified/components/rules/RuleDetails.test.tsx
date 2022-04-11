import { render } from '@testing-library/react';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';
import { mockCombinedRule, mockDataSource, mockPromAlertingRule, mockRulerAlertingRule } from '../../mocks';
import { RuleDetails } from './RuleDetails';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';

jest.mock('../../hooks/useIsRuleEditable');

const mocks = {
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: 'Edit' }),
    delete: byRole('button', { name: 'Delete' }),
    silence: byRole('link', { name: 'Silence' }),
  },
};

jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(true);

describe('RuleDetails FGAC', () => {
  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });
    it('Should not render Edit button for users without the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users without the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: false });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(grafanaRule);

      // Assert
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
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
    it('Should not render Edit button for users without the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users without the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: false });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      renderRuleDetails(cloudRule);

      // Assert
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
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

function getGrafanaRule(override?: Partial<CombinedRule>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Grafana',
      rulesSource: 'grafana',
    },
    ...override,
  });
}

function getCloudRule(override?: Partial<CombinedRule>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Cortex',
      rulesSource: mockDataSource(),
    },
    promRule: mockPromAlertingRule(),
    rulerRule: mockRulerAlertingRule(),
    ...override,
  });
}
