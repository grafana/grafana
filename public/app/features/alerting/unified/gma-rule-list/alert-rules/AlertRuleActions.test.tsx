import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { setFolderResponse } from '../../mocks/server/configure';
import { grantPermissionsHelper } from '../../test/test-utils';
import { K8sAnnotations } from '../../utils/k8s/constants';
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

function setRuleFolderAccess(canWrite: boolean, canDelete: boolean) {
  setFolderResponse({
    uid: RULE_FOLDER_UID,
    accessControl: {
      [AccessControlAction.AlertingRuleRead]: true,
      [AccessControlAction.FoldersRead]: true,
      [AccessControlAction.AlertingRuleUpdate]: canWrite,
      [AccessControlAction.AlertingRuleDelete]: canDelete,
    },
  });
}

function ruleWithPerms({
  canWrite = true,
  canDelete = true,
  paused = false,
  isProvisioned = false,
}: {
  canWrite?: boolean;
  canDelete?: boolean;
  paused?: boolean;
  isProvisioned?: boolean;
} = {}): AlertRule {
  setRuleFolderAccess(canWrite, canDelete);
  return {
    ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
    metadata: {
      name: 'rule-1',
      annotations: {
        [AnnoKeyFolder]: RULE_FOLDER_UID,
        ...(isProvisioned ? { [K8sAnnotations.Provenance]: 'terraform' } : {}),
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

  it('renders Edit and More buttons when edit is granted', async () => {
    renderActions(ruleWithPerms());

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('hides Edit and Pause without the write permission on the rule folder', async () => {
    renderActions(ruleWithPerms({ canWrite: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
  });

  it('hides Delete without the delete permission on the rule folder', async () => {
    renderActions(ruleWithPerms({ canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Pause when pause is granted and rule is active', async () => {
    renderActions(ruleWithPerms({ paused: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
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

  it('hides Edit and Pause/Delete for provisioned rules', async () => {
    const provisioned = ruleWithPerms({ isProvisioned: true });
    const editable = { ...ruleWithPerms(), metadata: { ...ruleWithPerms().metadata, name: 'rule-2' } };
    render(
      <ul>
        <li>
          <AlertRuleActions rule={provisioned} />
        </li>
        <li>
          <AlertRuleActions rule={editable} />
        </li>
      </ul>
    );

    expect(await screen.findAllByRole('link', { name: 'Edit' })).toHaveLength(1);
    await userEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('always shows View and Copy link in More menu regardless of permissions', async () => {
    renderActions(ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
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

  it('shows Duplicate when user has create permission and rule is not plugin-managed', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
  });

  it('hides Duplicate when user lacks create permission', async () => {
    grantPermissionsHelper([]);
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Duplicate/i })).not.toBeInTheDocument();
  });

  it('hides Duplicate for plugin-managed rules', async () => {
    const pluginRule = {
      ...ruleWithPerms(),
      spec: {
        ...ruleWithPerms().spec,
        labels: { __grafana_origin: 'plugin/my-plugin' },
      },
    };
    renderActions(pluginRule);

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Duplicate/i })).not.toBeInTheDocument();
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

  it('hides Silence when user lacks AlertingInstanceCreate and folder silence permission', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Silence/i })).not.toBeInTheDocument();
  });
});
