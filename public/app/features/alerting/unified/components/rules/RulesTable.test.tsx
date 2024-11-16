import { render, userEvent, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { getCloudRule, getGrafanaRule } from '../../mocks';

import { RulesTable } from './RulesTable';

jest.mock('../../hooks/useAbilities');

const mocks = {
  useAlertRuleAbility: jest.mocked(useAlertRuleAbility),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: 'Edit' }),
    view: byRole('link', { name: 'View' }),
    more: byRole('button', { name: /More/ }),
  },
  moreActionItems: {
    delete: byRole('menuitem', { name: 'Delete' }),
  },
};

const user = userEvent.setup();
setupMswServer();

describe('RulesTable RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, false] : [true, true];
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.get()).toBeInTheDocument();
    });

    describe('rules in creating/deleting states', () => {
      const { promRule, ...creatingRule } = grafanaRule;
      const { rulerRule, ...deletingRule } = grafanaRule;
      const rulesSource = 'grafana';

      /**
       * Preloaded state that implies the rulerRules have finished loading
       *
       * @todo Remove this state and test at a higher level to avoid mocking the store.
       * We need to manually populate this, as the component hierarchy expects that we will
       * have already called the necessary APIs to get the rulerRules data
       */
      const preloadedState = {
        unifiedAlerting: { rulerRules: { [rulesSource]: { result: {}, loading: false, dispatched: true } } },
      };

      beforeEach(() => {
        mocks.useAlertRuleAbility.mockImplementation(() => {
          return [true, true];
        });
      });

      it('does not render View button when rule is creating', async () => {
        render(<RulesTable rules={[creatingRule]} />, {
          // @ts-ignore
          preloadedState,
        });

        expect(await screen.findByText('Creating')).toBeInTheDocument();
        expect(ui.actionButtons.view.query()).not.toBeInTheDocument();
      });

      it('does not render View or Edit button when rule is deleting', async () => {
        render(<RulesTable rules={[deletingRule]} />, {
          // @ts-ignore
          preloadedState,
        });

        expect(await screen.findByText('Deleting')).toBeInTheDocument();
        expect(ui.actionButtons.view.query()).not.toBeInTheDocument();
        expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, false] : [true, true];
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
