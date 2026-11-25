import { HttpResponse, http } from 'msw';
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from 'test/test-utils';

import {
  API_GROUP,
  API_VERSION,
  type AlertRule,
  type RuleSequence,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { mockBoundingClientRect } from '@grafana/test-utils';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { FOLDER_ANNOTATION, alertRuleFactory, folderFactory } from '../mocks/factories';
import { FOLDER_SEARCH_URL, getRuleSequenceSearchHandler } from '../mocks/handlers';

import { LegacyGroupsView } from './LegacyGroupsView';

setupMswServer();

// The Prometheus API sends each group's folder as a full path.
const FOLDER_PATHS: Record<string, string> = {
  platform: 'Platform',
  'existing-cpu': 'Platform/cpu',
  'new-cpu': 'Platform/cpu',
};

interface PromRule {
  uid: string;
  name: string;
  type: 'alerting' | 'recording';
  provenance?: string;
  labels?: Record<string, string>;
}

interface PromGroup {
  name: string;
  folderUid: string;
  file: string;
  interval: number;
  rules: PromRule[];
}

/**
 * The stack-wide Prometheus rules listing, with the server's word-in-order search on group names and folder paths,
 * sorted by folder path as with alertingRuleGroupSortByFolderFullpath. It pages by `groupsPerPage` groups, standing
 * in for the server's rule limit.
 */
function prometheusRulesHandler(getGroups: () => PromGroup[], groupsPerPage = Infinity) {
  return http.get('/api/prometheus/grafana/api/v1/rules', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const groupSearch = params.get('search.rule_group');
    const groups = [...getGroups()]
      .sort((a, b) => Number(a.file > b.file) - Number(a.file < b.file))
      .filter(
        (group) =>
          (!groupSearch || (!group.name.startsWith('no_group_for_rule_') && matchesWords(group.name, groupSearch))) &&
          matchesWords(group.file, params.get('search.folder') ?? '')
      );
    const start = Number(params.get('group_next_token') ?? 0);
    const end = start + groupsPerPage;
    return HttpResponse.json({
      status: 'success',
      data: { groups: groups.slice(start, end), groupNextToken: end < groups.length ? String(end) : undefined },
    });
  });
}

function matchesWords(text: string, search: string) {
  let from = 0;
  for (const word of search.toLowerCase().split(/\s+/).filter(Boolean)) {
    const index = text.toLowerCase().indexOf(word, from);
    if (index === -1) {
      return false;
    }
    from = index + word.length;
  }
  return true;
}

function promGroup(file: string, folderUid: string, name: string, rules: Array<Partial<PromRule>>): PromGroup {
  return {
    name,
    folderUid,
    file,
    interval: 60,
    rules: rules.map((rule, index) => ({
      uid: `${folderUid}-${name}-${index}`,
      name: 'Rule',
      type: 'alerting',
      ...rule,
    })),
  };
}

interface TestRule {
  uid: string;
  title: string;
  provenance?: string;
}

/**
 * Serves the Prometheus groups, the rule GET and PUT, and folder access from one set of k8s rules, so a moved rule
 * leaves its group the way it does on the server.
 */
function setupLegacyGroupsBackend({
  rules,
  existingSubfolder,
  sequences = [],
  failFolderCreate = false,
  failOnce,
  readOnlyFolders = [],
  failSequenceSearch = false,
  deleteOnRead,
  failReloadOnce = false,
}: {
  rules: TestRule[];
  existingSubfolder?: string;
  sequences?: RuleSequence[];
  failFolderCreate?: boolean;
  /** The first PUTs of this rule (one unless `times` says otherwise) fail with this status. */
  failOnce?: { uid: string; status: number; times?: number };
  /** Folders where the user can't create rules. */
  readOnlyFolders?: string[];
  failSequenceSearch?: boolean;
  /** This rule is gone by the time the conversion reads it. */
  deleteOnRead?: string;
  /** The first listing request after a rule is saved fails, as the reload after a conversion would. */
  failReloadOnce?: boolean;
}) {
  const stored = new Map<string, AlertRule>(
    rules.map((rule, index) => [
      rule.uid,
      alertRuleFactory.inFolder('platform').build({
        metadata: { name: rule.uid, labels: { 'grafana.com/group': 'cpu', 'grafana.com/group-index': String(index) } },
        spec: { title: rule.title },
      }),
    ])
  );
  const provenance = new Map(rules.map((rule) => [rule.uid, rule.provenance ?? '']));

  // Groups by folder and group label, the way the server reads them; ungrouped rules get a placeholder group each.
  const currentGroups = () => {
    const groups = new Map<string, PromGroup>();
    for (const rule of stored.values()) {
      const folderUid = rule.metadata.annotations?.[FOLDER_ANNOTATION] ?? '';
      const name = rule.metadata.labels?.['grafana.com/group'] || `no_group_for_rule_${rule.metadata.name}`;
      const key = `${folderUid}/${name}`;
      const group = groups.get(key) ?? promGroup(FOLDER_PATHS[folderUid] ?? folderUid, folderUid, name, []);
      group.rules.push({
        uid: rule.metadata.name ?? '',
        name: rule.spec.title,
        type: 'alerting',
        provenance: provenance.get(rule.metadata.name ?? ''),
      });
      groups.set(key, group);
    }
    return [...groups.values()];
  };

  const rulesBase = `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/alertrules/:name`;
  server.use(
    prometheusRulesHandler(currentGroups),
    http.get(rulesBase, ({ params }) => {
      const rule = stored.get(String(params.name));
      if (deleteOnRead === params.name) {
        stored.delete(String(params.name));
      }
      return rule && deleteOnRead !== params.name
        ? HttpResponse.json(rule)
        : HttpResponse.json({ message: 'not found' }, { status: 404 });
    }),
    http.put(rulesBase, async ({ params, request }) => {
      if (failOnce && params.name === failOnce.uid) {
        const { status, times = 1 } = failOnce;
        failOnce = times > 1 ? { ...failOnce, times: times - 1 } : undefined;
        return HttpResponse.json({ message: 'update failed' }, { status });
      }
      const body = (await request.json()) as AlertRule;
      if (!stored.has(String(params.name))) {
        return HttpResponse.json({ message: 'not found' }, { status: 404 });
      }
      stored.set(String(params.name), body);
      if (failReloadOnce) {
        failReloadOnce = false;
        server.use(
          http.get(
            '/api/prometheus/grafana/api/v1/rules',
            () => HttpResponse.json({ message: 'unavailable' }, { status: 503 }),
            {
              once: true,
            }
          )
        );
      }
      return HttpResponse.json(body);
    }),
    http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/access', ({ params }) =>
      HttpResponse.json({
        accessControl: {
          'alert.rules:read': true,
          'folders:read': true,
          'alert.rules:delete': true,
          'alert.rules:create': !readOnlyFolders.includes(String(params.name)),
        },
      })
    ),
    http.post(FOLDER_SEARCH_URL, () =>
      HttpResponse.json({ items: existingSubfolder ? [{ resource: { name: existingSubfolder } }] : [], metadata: {} })
    ),
    failSequenceSearch
      ? http.post(`/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/rulesequences/search`, () =>
          HttpResponse.json({ message: 'unavailable' }, { status: 500 })
        )
      : getRuleSequenceSearchHandler(sequences),
    http.post('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders', async ({ request }) => {
      if (failFolderCreate) {
        return HttpResponse.json({ message: 'should not create' }, { status: 500 });
      }
      const body = (await request.json()) as { spec: { title: string } };
      return HttpResponse.json(
        folderFactory.inFolder('platform').build({ metadata: { name: 'new-cpu' }, spec: { title: body.spec.title } })
      );
    })
  );
}

async function expandPlatform() {
  const view = render(<LegacyGroupsView />);
  await view.user.click(await screen.findByRole('button', { name: 'Expand Platform' }));
  return view;
}

async function convertCpu(user: ReturnType<typeof render>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(await within(dialog).findByRole('button', { name: 'Convert' }));
  return dialog;
}

describe('LegacyGroupsView', () => {
  beforeAll(() => {
    // jsdom has no layout: every row and the list measure 40px, so the virtual list shows about a dozen rows.
    mockBoundingClientRect({ height: 40, width: 800 });
  });

  it("lists folders that hold groups with alert rules in the server's order, with the parent path", async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Zeta', 'zeta', 'latency', [{}]),
        promGroup('Alpha', 'alpha', 'recording-only', [{ type: 'recording' }]),
        promGroup('Platform/db', 'platform-db', 'disk', [{}, { type: 'recording' }]),
        promGroup('Platform', 'platform', 'no_group_for_rule_x', [{}]),
        promGroup('Platform', 'platform', 'cpu', [{}]),
        promGroup('Teams\\/Ops', 'teams-ops', 'pager', [{}]),
      ])
    );

    render(<LegacyGroupsView />);

    expect(await screen.findByRole('link', { name: 'Zeta' })).toBeInTheDocument();
    const folderLinks = screen.getAllByRole('link').map((link) => link.textContent);
    expect(folderLinks).toEqual(['Platform', 'db', 'Teams/Ops', 'Zeta']);
    expect(screen.getByRole('link', { name: 'db' }).closest('li')).toHaveTextContent('dbPlatform');
  });

  it('renders only the rows in view and loads the next page when the end of the list scrolls into view', async () => {
    const titles = Array.from({ length: 30 }, (_, index) => `Folder ${String(index).padStart(2, '0')}`);
    server.use(
      prometheusRulesHandler(
        () => [...titles, 'Zeta'].map((title) => promGroup(title, title, 'cpu', [{}])),
        titles.length
      )
    );

    render(<LegacyGroupsView />);

    expect(await screen.findByRole('link', { name: 'Folder 00' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Folder 29' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zeta' })).not.toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Legacy groups by folder' });
    fireEvent.scroll(list.parentElement!, { target: { scrollTop: 40 * 30 } });

    expect(await screen.findByRole('link', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Folder 29' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Folder 00' })).not.toBeInTheDocument();
  });

  it('searches group names on the server', async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Alpha', 'alpha', 'cpu usage', [{}]),
        promGroup('Beta', 'beta', 'memory', [{}]),
      ])
    );

    const { user } = render(<LegacyGroupsView />);
    await screen.findByRole('link', { name: 'Beta' });
    await user.type(screen.getByRole('textbox', { name: 'Search by group name' }), 'CPU');

    // The full list goes while the search loads, then only the match comes back.
    await waitForElementToBeRemoved(() => screen.queryByRole('link', { name: 'Beta' }));
    // Folders stay collapsed during a search too; the match is one click away.
    await user.click(await screen.findByRole('button', { name: 'Expand Alpha' }));
    expect(screen.getByRole('button', { name: 'Show rules in cpu usage' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Beta' })).not.toBeInTheDocument();
  });

  it('points to the folder filter when a group-name search matches nothing', async () => {
    server.use(prometheusRulesHandler(() => [promGroup('Users', 'users', 'cpu', [{}])]));

    const { user } = render(<LegacyGroupsView />);
    await screen.findByRole('link', { name: 'Users' });
    await user.type(screen.getByRole('textbox', { name: 'Search by group name' }), 'users');

    expect(await screen.findByText('Looking for a folder? Use the folder filter.')).toBeInTheDocument();
  });

  it('shows how many groups each folder holds', async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Alpha', 'alpha', 'cpu', [{}]),
        promGroup('Alpha', 'alpha', 'memory', [{}]),
        promGroup('Beta', 'beta', 'disk', [{}]),
      ])
    );

    render(<LegacyGroupsView />);

    expect((await screen.findByRole('link', { name: 'Alpha' })).closest('li')).toHaveTextContent('2 groups');
    expect(screen.getByRole('link', { name: 'Beta' }).closest('li')).toHaveTextContent('1 group');
  });

  it('filters by folder path on the server and says when nothing matches', async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Platform/db', 'platform-db', 'disk', [{}]),
        promGroup('Teams', 'teams', 'pager', [{}]),
      ])
    );

    const { user } = render(<LegacyGroupsView />);
    await screen.findByRole('link', { name: 'Teams' });
    const folderFilter = screen.getByRole('textbox', { name: 'Filter by folder' });
    await user.type(folderFilter, 'platform db');

    await waitForElementToBeRemoved(() => screen.queryByRole('link', { name: 'Teams' }));
    expect(await screen.findByRole('link', { name: 'db' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Teams' })).not.toBeInTheDocument();

    await user.type(folderFilter, ' nothing');
    expect(await screen.findByText('No groups match')).toBeInTheDocument();
  });

  it('sends search text with regex characters unescaped', async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Accounts us-east', 'us-east', 'cache-hit-ratio', [{}]),
        promGroup('Accounts eu-west', 'eu-west', 'cpu', [{}]),
      ])
    );

    const { user } = render(<LegacyGroupsView />);
    await screen.findByRole('link', { name: 'Accounts eu-west' });
    await user.type(screen.getByRole('textbox', { name: 'Filter by folder' }), 'us-east');
    await user.type(screen.getByRole('textbox', { name: 'Search by group name' }), 'hit-ratio');

    await waitForElementToBeRemoved(() => screen.queryByRole('link', { name: 'Accounts eu-west' }));
    await user.click(await screen.findByRole('button', { name: 'Expand Accounts us-east' }));
    expect(screen.getByRole('button', { name: 'Show rules in cache-hit-ratio' })).toBeInTheDocument();
  });

  it('keeps provisioned and sequenced rules in the group and moves the rest into the new subfolder', async () => {
    setupLegacyGroupsBackend({
      rules: [
        { uid: 'a', title: 'High CPU' },
        { uid: 'b', title: 'CPU steal', provenance: 'api' },
        { uid: 'c', title: 'CPU throttling' },
      ],
      sequences: [
        {
          metadata: { name: 'seq' },
          spec: { recordingRules: [], alertingRules: [{ name: 'c' }], trigger: { interval: '1m' } },
        } as unknown as RuleSequence,
      ],
    });

    const { user, unmount } = await expandPlatform();
    expect(await screen.findByText('1 provisioned')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Rules move into a new folder/)).toHaveTextContent(
      'Rules move into a new folder, Platform / cpu.'
    );
    const moves = within(dialog).getByRole('list', { name: 'Moves (1)' });
    expect(within(moves).getByText('High CPU')).toBeInTheDocument();
    const stays = within(dialog).getByRole('list', { name: 'Stays in the group (2)' });
    expect(within(stays).getByText('CPU steal').closest('li')).toHaveTextContent('Provisioned');
    expect(within(stays).getByText('CPU throttling').closest('li')).toHaveTextContent('In a rule sequence');

    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('2 alert rules')).toBeInTheDocument();

    // A fresh load shows what the server kept: the moved rule lost its group labels.
    unmount();
    const reloaded = await expandPlatform();
    await reloaded.user.click(await screen.findByRole('button', { name: 'Show rules in cpu' }));
    const remaining = screen.getByRole('list', { name: 'Rules in cpu' });
    expect(within(remaining).getByText('CPU steal')).toBeInTheDocument();
    expect(within(remaining).queryByText('High CPU')).not.toBeInTheDocument();
    // The new subfolder holds only the ungrouped rule, so it isn't listed.
    expect(screen.queryByRole('button', { name: 'Expand cpu' })).not.toBeInTheDocument();
  });

  it('moves the rules into an existing folder of the same name instead of creating one', async () => {
    setupLegacyGroupsBackend({
      rules: [{ uid: 'a', title: 'High CPU' }],
      existingSubfolder: 'existing-cpu',
      failFolderCreate: true,
    });

    const { user } = await expandPlatform();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Platform / cpu already exists')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));

    expect(await screen.findByText('No legacy groups')).toBeInTheDocument();
  });

  it('shows how many rules moved when an update fails, and Retry moves the rest', async () => {
    setupLegacyGroupsBackend({
      rules: [
        { uid: 'a', title: 'High CPU' },
        { uid: 'b', title: 'CPU steal' },
      ],
      failOnce: { uid: 'b', status: 500 },
    });

    const { user } = await expandPlatform();
    const dialog = await convertCpu(user);

    expect(await within(dialog).findByText('1 of 2 rules moved')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No legacy groups')).toBeInTheDocument();
  });

  it('counts a rule changed elsewhere once when a retry fails again', async () => {
    setupLegacyGroupsBackend({
      rules: [
        { uid: 'a', title: 'High CPU' },
        { uid: 'b', title: 'CPU steal' },
      ],
      deleteOnRead: 'a',
      failOnce: { uid: 'b', status: 500, times: 2 },
    });

    const { user } = await expandPlatform();
    const dialog = await convertCpu(user);

    expect(await within(dialog).findByText('1 rule was changed elsewhere and left as it is.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));

    expect(await within(dialog).findByText('0 of 2 rules moved')).toBeInTheDocument();
    expect(within(dialog).getByText('1 rule was changed elsewhere and left as it is.')).toBeInTheDocument();
  });

  it('drops the moved rules from the group when the drawer is closed after a failure', async () => {
    setupLegacyGroupsBackend({
      rules: [
        { uid: 'a', title: 'High CPU' },
        { uid: 'b', title: 'CPU steal' },
      ],
      failOnce: { uid: 'b', status: 500 },
    });

    const { user } = await expandPlatform();
    const dialog = await convertCpu(user);
    expect(await within(dialog).findByText('1 of 2 rules moved')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('1 alert rule')).toBeInTheDocument();
  });

  it('offers to reload again when the reload after a conversion fails', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU' }], failReloadOnce: true });

    const { user } = await expandPlatform();
    await convertCpu(user);

    expect(await screen.findByText('Failed to refresh results')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No legacy groups')).toBeInTheDocument();
  });

  it('moves a rule that someone else saved during the conversion by reading it again', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU' }], failOnce: { uid: 'a', status: 409 } });

    const { user } = await expandPlatform();
    await convertCpu(user);

    expect(await screen.findByText('No legacy groups')).toBeInTheDocument();
  });

  it('keeps the rules in the group when the user cannot create rules in the existing subfolder', async () => {
    setupLegacyGroupsBackend({
      rules: [{ uid: 'a', title: 'High CPU' }],
      existingSubfolder: 'existing-cpu',
      readOnlyFolders: ['existing-cpu'],
    });

    const { user } = await expandPlatform();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    const stays = await within(dialog).findByRole('list', { name: 'Stays in the group (1)' });
    expect(within(stays).getByText('High CPU').closest('li')).toHaveTextContent('No permission to move');
    expect(within(dialog).getByRole('button', { name: 'Convert' })).toBeDisabled();
  });

  it('disables Convert for a group whose rules are all provisioned, and says why', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU', provenance: 'file' }] });

    const { user } = await expandPlatform();
    const convert = await screen.findByRole('button', { name: 'Convert cpu to subfolder' });
    expect(convert).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Provisioned')).toBeInTheDocument();

    await user.hover(convert);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Converting provisioned groups isn’t supported. Change the grouping in your provisioning setup.'
    );
    await user.click(convert);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables Convert for a group whose rules are all managed by a plugin, and says why', async () => {
    server.use(
      prometheusRulesHandler(() => [
        promGroup('Platform', 'platform', 'slo', [{ labels: { __grafana_origin: 'plugin/grafana-slo-app' } }]),
      ])
    );

    const { user } = await expandPlatform();
    const convert = await screen.findByRole('button', { name: 'Convert slo to subfolder' });
    expect(convert).toHaveAttribute('aria-disabled', 'true');

    await user.hover(convert);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Converting groups managed by a plugin isn’t supported. The plugin manages their grouping.'
    );
  });

  it('puts the drawer buttons before the rule list in keyboard order', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU' }] });

    const { user } = await expandPlatform();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    const ruleLink = await within(dialog).findByRole('link', { name: 'High CPU' });
    const convert = within(dialog).getByRole('button', { name: 'Convert' });
    expect(convert.compareDocumentPosition(ruleLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getByText('This can’t be undone')).toBeInTheDocument();
  });

  it('says why nothing can move when every rule stays in the group', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU' }], failSequenceSearch: true });

    const { user } = await expandPlatform();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('None of these rules can move')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Rules move into a new folder/)).not.toBeInTheDocument();
  });

  it('keeps rules in the group when their sequence membership cannot be checked', async () => {
    setupLegacyGroupsBackend({ rules: [{ uid: 'a', title: 'High CPU' }], failSequenceSearch: true });

    const { user } = await expandPlatform();
    await user.click(await screen.findByRole('button', { name: 'Convert cpu to subfolder' }));

    const dialog = await screen.findByRole('dialog');
    const stays = await within(dialog).findByRole('list', { name: 'Stays in the group (1)' });
    expect(within(stays).getByText('High CPU').closest('li')).toHaveTextContent('Couldn’t check rule sequences');
  });

  it('drops a rule deleted during the conversion and moves the others', async () => {
    setupLegacyGroupsBackend({
      rules: [
        { uid: 'a', title: 'High CPU' },
        { uid: 'b', title: 'CPU steal' },
      ],
      deleteOnRead: 'a',
    });

    const { user } = await expandPlatform();
    await convertCpu(user);

    expect(await screen.findByText('No legacy groups')).toBeInTheDocument();
  });
});
