import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { mockCombinedRule } from '../../mocks';

import { RuleDetails } from './RuleDetails';

const ui = {
  actionButtons: {
    edit: byRole('link', { name: 'Edit' }),
    delete: byRole('button', { name: 'Delete' }),
    silence: byRole('link', { name: 'Silence' }),
  },
};

jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(true);

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

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
