import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useEnrichmentAbility } from '../../hooks/abilities/otherAbilities';
import {
  usePromRuleAdministrationAbility,
  usePromRuleExportAbility,
  usePromRuleSilenceAbility,
} from '../../hooks/abilities/rules/promRuleAbilities';
import { useRuleExploreAbility } from '../../hooks/abilities/rules/ruleAbilities';
import { type RuleEditAbilityResult } from '../../hooks/abilities/rules/ruleAbilities.utils';
import {
  useRuleAdministrationAbility,
  useRuleExportAbility,
  useRuleSilenceAbility,
} from '../../hooks/abilities/rules/rulerRuleAbilities';
import { type Ability, Granted, InsufficientPermissions, NotSupported } from '../../hooks/abilities/types';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesTable } from './RulesTable';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

jest.mock('../../hooks/abilities/rules/promRuleAbilities');
jest.mock('../../hooks/abilities/rules/rulerRuleAbilities');
// Keep real get* implementations — they are called by datasource.ts and access-control.ts
// in non-React code paths triggered during these tests. Only mock the React hooks.
jest.mock('../../hooks/abilities/rules/ruleAbilities', () => ({
  ...jest.requireActual('../../hooks/abilities/rules/ruleAbilities'),
  useRuleExploreAbility: jest.fn(),
}));
jest.mock('../../hooks/abilities/otherAbilities');

/** Denied Ability for simple cases */
const Denied: Ability = NotSupported;

/** A fully-denied RuleEditAbilityResult (ruler path) */
function deniedEditAbility(): RuleEditAbilityResult {
  return {
    update: Denied,
    delete: Denied,
    restore: Denied,
    pause: Denied,
    duplicate: Denied,
    deletePermanently: Denied,
    loading: false,
  };
}

/** A fully-granted RuleEditAbilityResult (ruler path) */
function grantedEditAbility(): RuleEditAbilityResult {
  return {
    update: Granted,
    delete: Granted,
    restore: Granted,
    pause: Granted,
    duplicate: Granted,
    deletePermanently: Granted,
    loading: false,
  };
}

/** A fully-denied RuleEditAbilityResult (prom path) */
function deniedPromAdminAbility(): RuleEditAbilityResult {
  return {
    update: Denied,
    delete: Denied,
    restore: Denied,
    pause: Denied,
    duplicate: Denied,
    deletePermanently: Denied,
    loading: false,
  };
}

/** A fully-granted RuleEditAbilityResult (prom path) */
function grantedPromAdminAbility(): RuleEditAbilityResult {
  return {
    update: Granted,
    delete: Granted,
    restore: Granted,
    pause: Granted,
    duplicate: Granted,
    deletePermanently: Granted,
    loading: false,
  };
}

const mocks = {
  useRuleAdministrationAbility: jest.mocked(useRuleAdministrationAbility),
  useRuleSilenceAbility: jest.mocked(useRuleSilenceAbility),
  useRuleExportAbility: jest.mocked(useRuleExportAbility),
  useRuleExploreAbility: jest.mocked(useRuleExploreAbility),
  usePromRuleAdministrationAbility: jest.mocked(usePromRuleAdministrationAbility),
  usePromRuleSilenceAbility: jest.mocked(usePromRuleSilenceAbility),
  usePromRuleExportAbility: jest.mocked(usePromRuleExportAbility),
  useEnrichmentAbility: jest.mocked(useEnrichmentAbility),
};

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

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

const { dataSource: mimirDs } = mimirDataSource();

describe('RulesTable RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();

    // Default: nothing granted
    mocks.useRuleAdministrationAbility.mockReturnValue(deniedEditAbility());
    mocks.useRuleSilenceAbility.mockReturnValue(Denied);
    mocks.useRuleExportAbility.mockReturnValue(Denied);
    mocks.useRuleExploreAbility.mockReturnValue(Denied);
    mocks.usePromRuleAdministrationAbility.mockReturnValue(deniedPromAdminAbility());
    mocks.usePromRuleSilenceAbility.mockReturnValue(Denied);
    mocks.usePromRuleExportAbility.mockReturnValue(Denied);
    mocks.useEnrichmentAbility.mockReturnValue(Denied);
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: InsufficientPermissions([]),
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        update: InsufficientPermissions([]),
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: InsufficientPermissions([]),
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        delete: InsufficientPermissions([]),
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: Granted,
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        update: Granted,
      });

      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: Granted,
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        delete: Granted,
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.get()).toBeInTheDocument();
    });

    describe('rules in creating/deleting states', () => {
      const { promRule, ...creatingRule } = grafanaRule;
      const { rulerRule, ...deletingRule } = grafanaRule;
      const rulesSource = 'grafana';

      const preloadedState = {
        unifiedAlerting: { rulerRules: { [rulesSource]: { result: {}, loading: false, dispatched: true } } },
      };

      beforeEach(() => {
        mocks.useRuleAdministrationAbility.mockReturnValue(grantedEditAbility());
        mocks.usePromRuleAdministrationAbility.mockReturnValue(grantedPromAdminAbility());
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
    const cloudRule = getCloudRule({ name: 'Cloud' }, { rulesSource: mimirDs });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: InsufficientPermissions([]),
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        update: InsufficientPermissions([]),
      });

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: InsufficientPermissions([]),
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        delete: InsufficientPermissions([]),
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: Granted,
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        update: Granted,
      });

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: Granted,
      });
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedPromAdminAbility(),
        delete: Granted,
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
