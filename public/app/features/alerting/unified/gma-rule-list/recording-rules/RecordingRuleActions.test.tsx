import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { setFolderResponse } from '../../mocks/server/configure';
import { grantPermissionsHelper } from '../../test/test-utils';

import { RecordingRuleActions } from './RecordingRuleActions';

const server = setupMswServer();

const RULE_FOLDER_UID = 'rule-folder';

const canRead = { [AccessControlAction.AlertingRuleRead]: true, [AccessControlAction.FoldersRead]: true };
const canWrite = { [AccessControlAction.AlertingRuleUpdate]: true };
const canDelete = { [AccessControlAction.AlertingRuleDelete]: true };

function setRuleFolderAccess(accessControl: Record<string, boolean>) {
  setFolderResponse({ uid: RULE_FOLDER_UID, accessControl: { ...canRead, ...accessControl } });
}

function ruleWithPerms({
  paused = false,
}: {
  paused?: boolean;
} = {}): RecordingRule {
  setRuleFolderAccess({ ...canWrite, ...canDelete });
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'RecordingRule',
    metadata: {
      name: 'rule-1',
      annotations: {
        [AnnoKeyFolder]: RULE_FOLDER_UID,
      },
    },
    spec: {
      title: 'cpu:usage:rate5m',
      metric: 'cpu:usage:rate5m',
      targetDatasourceUID: 'gdev-prometheus',
      trigger: { interval: '1m' },
      expressions: {},
      paused,
    },
  };
}

function renderActions(rule: RecordingRule) {
  return render(
    <ul>
      <li>
        <RecordingRuleActions rule={rule} />
      </li>
    </ul>
  );
}

describe('RecordingRuleActions', () => {
  beforeEach(() => {
    grantPermissionsHelper([AccessControlAction.AlertingRuleCreate]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Edit, Pause and Duplicate, and never Silence, with write access to the rule folder', async () => {
    const rule = ruleWithPerms();
    setRuleFolderAccess(canWrite);
    renderActions(rule);

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      expect.stringContaining('kind=recording')
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Silence/i })).not.toBeInTheDocument();
  });

  it('shows Delete, View and Copy link with delete access to the rule folder', async () => {
    grantPermissionsHelper([]);
    const rule = ruleWithPerms();
    setRuleFolderAccess(canDelete);
    renderActions(rule);

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Duplicate/i })).not.toBeInTheDocument();
  });

  it('shows Resume when rule is paused', async () => {
    renderActions(ruleWithPerms({ paused: true }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Resume/i })).toBeInTheDocument();
  });

  it('shows Delete confirmation dialog on Delete click', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "cpu:usage:rate5m"?');
  });

  it('links View to the rule view with a way back to the current page', async () => {
    render(
      <ul>
        <li>
          <RecordingRuleActions rule={ruleWithPerms()} />
        </li>
      </ul>,
      { historyOptions: { initialEntries: ['/alerting/rules/recording?search=cpu'] } }
    );

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view?returnTo=%2Falerting%2Frules%2Frecording%3Fsearch%3Dcpu'
    );
  });

  it('calls DELETE after confirmation', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/recordingrules/:name`, () => {
        deleteCalled = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );

    renderActions(ruleWithPerms());
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Delete/i }));

    expect(deleteCalled).toBe(true);
  });
});
