import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { byTestId, byText } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

import { disableRBAC, mockCombinedRule, mockDataSource } from '../../mocks';

import { RulesGroup } from './RulesGroup';

const hasRulerMock = jest.fn<boolean, any>();
jest.mock('../../hooks/useHasRuler', () => ({
  useHasRuler: () => hasRulerMock,
}));

beforeEach(() => {
  hasRulerMock.mockReset();
});

const ui = {
  editGroupButton: byTestId('edit-group'),
  deleteGroupButton: byTestId('delete-group'),
  confirmDeleteModal: {
    header: byText('Delete group'),
    confirmButton: byText('Delete'),
  },
};

describe('Rules group tests', () => {
  const store = configureStore();

  function renderRulesGroup(namespace: CombinedRuleNamespace, group: CombinedRuleGroup) {
    return render(
      <Provider store={store}>
        <RulesGroup group={group} namespace={namespace} expandAll={false} />
      </Provider>
    );
  }

  describe('When the datasource is grafana', () => {
    const group: CombinedRuleGroup = {
      name: 'TestGroup',
      rules: [mockCombinedRule()],
    };

    const namespace: CombinedRuleNamespace = {
      name: 'TestNamespace',
      rulesSource: 'grafana',
      groups: [group],
    };

    it('Should hide delete and edit group buttons', () => {
      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });
  });

  describe('When the datasource is not grafana', () => {
    beforeEach(() => {
      contextSrv.isEditor = true;
    });

    const group: CombinedRuleGroup = {
      name: 'TestGroup',
      rules: [mockCombinedRule()],
    };

    const namespace: CombinedRuleNamespace = {
      name: 'TestNamespace',
      rulesSource: mockDataSource(),
      groups: [group],
    };

    disableRBAC();

    it('When ruler enabled should display delete and edit group buttons', () => {
      // Arrange
      hasRulerMock.mockReturnValue(true);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(hasRulerMock).toHaveBeenCalled();
      expect(ui.deleteGroupButton.get()).toBeInTheDocument();
      expect(ui.editGroupButton.get()).toBeInTheDocument();
    });

    it('When ruler disabled should hide delete and edit group buttons', () => {
      // Arrange
      hasRulerMock.mockReturnValue(false);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(hasRulerMock).toHaveBeenCalled();
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Delete button click should display confirmation modal', async () => {
      // Arrange
      hasRulerMock.mockReturnValue(true);

      // Act
      renderRulesGroup(namespace, group);
      await userEvent.click(ui.deleteGroupButton.get());

      // Assert
      expect(ui.confirmDeleteModal.header.get()).toBeInTheDocument();
      expect(ui.confirmDeleteModal.confirmButton.get()).toBeInTheDocument();
    });
  });
});
