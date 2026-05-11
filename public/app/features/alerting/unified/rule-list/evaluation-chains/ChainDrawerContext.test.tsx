import { render, testWithFeatureToggles } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import { mockGrafanaPromAlertingRule } from '../../mocks';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';

import { ChainDrawerProvider } from './ChainDrawerContext';
import { useGrafanaRuleChainMembership } from './useGrafanaRuleChainMembership';

jest.mock('./useGrafanaRuleChainMembership');
jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isLoading: false, isAvailable: false, openAssistant: jest.fn() }),
  createAssistantContextItem: jest.fn((type, data) => ({ type, ...data })),
}));

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  chainLink: byRole('button', { name: /open evaluation chain/i }),
  drawer: byRole('dialog', { name: /evaluation chain/i }),
};

const groupIdentifier: GrafanaRuleGroupIdentifier = {
  groupName: 'my-group',
  namespace: { uid: 'NAMESPACE_UID' },
  groupOrigin: 'grafana',
};

function renderRuleRow() {
  return render(
    <ChainDrawerProvider>
      <GrafanaRuleListItem
        rule={mockGrafanaPromAlertingRule()}
        groupIdentifier={groupIdentifier}
        namespaceName="My folder"
      />
    </ChainDrawerProvider>
  );
}

describe('ChainDrawer integration', () => {
  describe('when alerting.rulesAPIV2 is enabled and the rule has chain membership', () => {
    testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

    beforeEach(() => {
      jest.mocked(useGrafanaRuleChainMembership).mockReturnValue({
        id: 'usage-chain',
        position: 2,
        total: 4,
      });
    });

    it('renders the chain link and opens the drawer on click', async () => {
      const { user } = renderRuleRow();

      const link = await ui.chainLink.find();
      expect(link).toHaveAccessibleName(/position 2 of 4/i);

      await user.click(link);

      const drawer = await ui.drawer.find();
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('when the hook returns no membership', () => {
    beforeEach(() => {
      jest.mocked(useGrafanaRuleChainMembership).mockReturnValue(undefined);
    });

    it('does not render the chain link', () => {
      renderRuleRow();
      expect(ui.chainLink.query()).not.toBeInTheDocument();
    });
  });
});
