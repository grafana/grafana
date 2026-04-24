import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import { ChainPill } from './ChainPill';

// Don't load the lazy V3 page's heavy children — we only need to verify the
// chain pill -> drawer wiring at the page level.
jest.mock('./FlatRuleListView', () => {
  const { ChainPill } = jest.requireActual('./ChainPill');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FlatRuleListView: ({ onChainPillClick }: { onChainPillClick: (id: string, position: number) => void }) => (
      <div data-testid="flat-rule-list-view">
        <ChainPill
          chainId="usage-chain"
          chainName="Usage Alerts Chain"
          position={2}
          total={4}
          onClick={onChainPillClick}
        />
      </div>
    ),
  };
});

jest.mock('../filter/RulesFilter.v2', () => ({
  __esModule: true,
  default: () => <div data-testid="rules-filter" />,
}));

jest.mock('../filter/RulesFilterSidebar', () => ({
  RulesFilterSidebar: () => <div data-testid="rules-filter-sidebar" />,
}));

jest.mock('./ChainFilterField', () => ({
  ChainFilterField: () => <div data-testid="chain-filter-field" />,
}));

jest.mock('../filter/useApplyDefaultSearch', () => ({
  useApplyDefaultSearch: () => ({ isApplying: false }),
}));

// Silence unrelated plugin hooks the page wrapper reaches for.
setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  drawer: byRole('dialog'),
  chainPill: byRole('button', { name: /Usage Alerts Chain/i }),
};

describe('RuleListV3 page', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  });

  testWithFeatureToggles({ enable: ['alertingListViewV2', 'alerting.rulesAPIV2'] });

  it('opens the chain drawer when the chain pill is clicked', async () => {
    const RuleListV3Page = (await import('./RuleList.v3')).default;
    const { user } = render(<RuleListV3Page />);

    // Flat view mock mounts — confirms V3 shell is what rendered.
    await waitFor(() => expect(ui.chainPill.get()).toBeInTheDocument());

    // No drawer open yet.
    expect(ui.drawer.query()).not.toBeInTheDocument();

    await user.click(ui.chainPill.get());

    // Drawer opens and shows the chain name.
    await waitFor(() => expect(ui.drawer.get()).toBeInTheDocument());
    expect(ui.drawer.get()).toHaveTextContent('Usage Alerts Chain');
  });
});

// Sanity: ensure the helper ChainPill re-export works for the mock above.
describe('ChainPill (import sanity)', () => {
  it('is a function component', () => {
    expect(typeof ChainPill).toBe('function');
  });
});
