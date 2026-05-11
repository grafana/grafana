import { render, screen, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';
import {
  type GrafanaPromAlertingRuleDTO,
  type GrafanaPromRuleGroupDTO,
  PromAlertingRuleState,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { USAGE_CHAIN_ID } from '../../mocks/fixtures/chains';
import { setGrafanaPromRules } from '../../mocks/server/configure';

import { GroupedRuleListView } from './GroupedRuleListView';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setReturnToPreviousHook(() => () => {});

setupMswServer();

// Two folders × two groups × three rules = 12 rules. DEMO_CHAIN_SIZE is 4, so the
// first four rules (folder A, group A1, all three rules + folder A, group A2's first rule)
// are tagged as chain members.
const folderA = 'folder-a';
const folderB = 'folder-b';

function makeRule(uid: string, name: string, folderUid: string): GrafanaPromAlertingRuleDTO {
  return {
    uid,
    name,
    query: 'up == 0',
    type: PromRuleType.Alerting,
    state: PromAlertingRuleState.Inactive,
    health: 'ok',
    folderUid,
    isPaused: false,
    totals: {},
    totalsFiltered: {},
    labels: {},
    annotations: {},
  };
}

function makeGroup(name: string, file: string, folderUid: string, rules: string[]): GrafanaPromRuleGroupDTO {
  return {
    name,
    file,
    folderUid,
    interval: 60,
    rules: rules.map((ruleName) => makeRule(`${folderUid}-${name}-${ruleName}`, ruleName, folderUid)),
  };
}

const allGroups: GrafanaPromRuleGroupDTO[] = [
  makeGroup('group-a1', 'Folder A', folderA, ['rule-a1-1', 'rule-a1-2', 'rule-a1-3']),
  makeGroup('group-a2', 'Folder A', folderA, ['rule-a2-1', 'rule-a2-2', 'rule-a2-3']),
  makeGroup('group-b1', 'Folder B', folderB, ['rule-b1-1', 'rule-b1-2', 'rule-b1-3']),
  makeGroup('group-b2', 'Folder B', folderB, ['rule-b2-1', 'rule-b2-2', 'rule-b2-3']),
];

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  setGrafanaPromRules(allGroups);
});

const ui = {
  dsSection: byRole('listitem', { name: /Grafana-managed/ }),
  chainLink: byRole('button', { name: /Open evaluation chain/i }),
};

describe('GroupedRuleListView', () => {
  it('renders folders containing collapsed group rows with name and interval', async () => {
    render(<GroupedRuleListView onChainLinkClick={() => {}} />);

    const dsSection = await ui.dsSection.find();

    expect(await within(dsSection).findByRole('link', { name: 'group-a1' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'group-a2' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'group-b1' })).toBeInTheDocument();

    // Per-group eval interval shows on the group header. 60s → "1m".
    expect(within(dsSection).getAllByText('1m').length).toBeGreaterThan(0);

    // Groups are collapsed by default, so rule rows are not in the DOM.
    expect(screen.queryByRole('link', { name: 'rule-a1-1' })).not.toBeInTheDocument();
  });

  it('with a chain filter, hides non-matching groups and folders, auto-opens surviving groups, and surfaces a chain link that invokes the click handler', async () => {
    const onChainLinkClick = jest.fn();
    const { user } = render(<GroupedRuleListView chainFilter={USAGE_CHAIN_ID} onChainLinkClick={onChainLinkClick} />);

    const dsSection = await ui.dsSection.find();

    // Folder A has chain-tagged rules across both groups → both group headers stay.
    expect(await within(dsSection).findByRole('link', { name: 'group-a1' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'group-a2' })).toBeInTheDocument();

    // Folder B has no chain-tagged rules → its groups are filtered out.
    expect(within(dsSection).queryByRole('link', { name: 'group-b1' })).not.toBeInTheDocument();
    expect(within(dsSection).queryByRole('link', { name: 'group-b2' })).not.toBeInTheDocument();

    // Surviving groups are auto-opened so matching rules are visible immediately.
    expect(within(dsSection).getByRole('link', { name: 'rule-a1-1' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'rule-a1-2' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'rule-a1-3' })).toBeInTheDocument();
    expect(within(dsSection).getByRole('link', { name: 'rule-a2-1' })).toBeInTheDocument();

    // Untagged rules inside a surviving group are filtered out.
    expect(within(dsSection).queryByRole('link', { name: 'rule-a2-2' })).not.toBeInTheDocument();

    // First tagged rule (position 1) has a chain link wired to the handler.
    const chainLinks = ui.chainLink.getAll();
    expect(chainLinks).toHaveLength(4);
    await user.click(chainLinks[0]);
    expect(onChainLinkClick).toHaveBeenCalledWith(USAGE_CHAIN_ID, 1);
  });
});
