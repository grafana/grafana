import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantPermissionsHelper } from '../../test/test-utils';
import { K8sAnnotations } from '../../utils/k8s/constants';

import { RecordingRuleActions } from './RecordingRuleActions';

const server = setupMswServer();

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
} = {}): RecordingRule {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'RecordingRule',
    metadata: {
      name: 'rule-1',
      annotations: {
        [K8sAnnotations.AccessWrite]: String(canWrite),
        [K8sAnnotations.AccessDelete]: String(canDelete),
        ...(isProvisioned ? { [K8sAnnotations.Provenance]: 'terraform' } : {}),
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

  it('renders Edit and More buttons when edit is granted', () => {
    renderActions(ruleWithPerms());

    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('hides Edit when canEdit is false', () => {
    renderActions(ruleWithPerms({ canWrite: false }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
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

  it('hides Pause and Delete when user has no write/delete permission', async () => {
    renderActions(ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Delete confirmation dialog on Delete click', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "cpu:usage:rate5m"?');
  });

  it('hides Edit and Pause/Delete for provisioned rules', async () => {
    renderActions(ruleWithPerms({ isProvisioned: true }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('always shows View and Copy link regardless of permissions', async () => {
    renderActions(ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
  });

  it('shows Duplicate when user has create permission', async () => {
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

  it('never shows Silence notifications (recording rules do not fire alerts)', async () => {
    renderActions(ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: /View/i });
    expect(screen.queryByRole('menuitem', { name: /Silence/i })).not.toBeInTheDocument();
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
