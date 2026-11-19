import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { setFolderResponse } from '../../mocks/server/configure';
import { grantPermissionsHelper } from '../../test/test-utils';
import { mockK8sAlertRule } from '../mocks/handlers';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
}));
const mockUseAssistant = jest.mocked(useAssistant);

function setAssistantAvailable(isAvailable: boolean) {
  mockUseAssistant.mockReturnValue({
    isLoading: false,
    isAvailable,
    openAssistant: isAvailable ? jest.fn() : undefined,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  });
}

import { AlertRuleActions } from './AlertRuleActions';
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
} = {}): AlertRule {
  setRuleFolderAccess({ ...canWrite, ...canDelete });
  return {
    ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
    metadata: {
      name: 'rule-1',
      annotations: {
        [AnnoKeyFolder]: RULE_FOLDER_UID,
      },
    },
    spec: {
      title: 'CPU high',
      expressions: {},
      execErrState: 'Error',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      paused,
    },
  };
}

function renderActions(rule: AlertRule) {
  return render(
    <ul>
      <li>
        <AlertRuleActions rule={rule} />
      </li>
    </ul>
  );
}

describe('AlertRuleActions', () => {
  beforeEach(() => {
    grantPermissionsHelper([AccessControlAction.AlertingRuleCreate]);
    setAssistantAvailable(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Edit, Pause and Duplicate with write access to the rule folder and the create permission', async () => {
    const rule = ruleWithPerms();
    setRuleFolderAccess(canWrite);
    renderActions(rule);

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Delete, Silence, View and Copy link with delete and silence access to the rule folder', async () => {
    grantPermissionsHelper([]);
    const rule = ruleWithPerms();
    setRuleFolderAccess({ ...canDelete, [AccessControlAction.AlertingSilenceCreate]: true });
    renderActions(rule);

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Silence notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
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
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "CPU high"?');
  });

  it('shows Analyze in More menu only when the assistant is available', async () => {
    setAssistantAvailable(true);
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Analyze rule/i })).toBeInTheDocument();
  });

  it('hides Analyze when the assistant is not available', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Analyze rule/i })).not.toBeInTheDocument();
  });

  it('calls DELETE to delete the rule after confirmation', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/alertrules/:name`, () => {
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

  it('shows and opens the Silence drawer when user has AlertingInstanceCreate permission', async () => {
    grantPermissionsHelper([AccessControlAction.AlertingInstanceCreate]);
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Silence notifications/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
