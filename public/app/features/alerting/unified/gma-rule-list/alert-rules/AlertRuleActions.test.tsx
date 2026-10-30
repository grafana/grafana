import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { mockK8sAlertRule } from '../mocks/handlers';

import { AlertRuleActions } from './AlertRuleActions';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

const server = setupMswServer();

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
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
  return {
    ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
    metadata: {
      name: 'rule-1',
      annotations: {
        [K8sAnnotations.AccessWrite]: String(canWrite),
        [K8sAnnotations.AccessDelete]: String(canDelete),
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

function renderActions(searchHit: AlertRuleSearchHit, rule: AlertRule | undefined) {
  return render(
    <ul>
      <li>
        <AlertRuleActions searchHit={searchHit} rule={rule} />
      </li>
    </ul>
  );
}

describe('AlertRuleActions', () => {
  it('renders Edit and More buttons when canEdit is true', () => {
    renderActions(baseHit(), ruleWithPerms());

    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('disables Edit and More while rule is loading', () => {
    render(
      <ul>
        <li>
          <AlertRuleActions searchHit={baseHit()} rule={undefined} ruleIsLoading={true} />
        </li>
      </ul>
    );

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
  });

  it('enables More but hides Edit after a failed rule fetch', async () => {
    renderActions(baseHit(), undefined);

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('hides Edit when canEdit is false after loading', () => {
    renderActions(baseHit(), ruleWithPerms({ canWrite: false }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    // More is still there
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('shows Pause in More menu when canPause is true and rule is active', async () => {
    renderActions(baseHit(), ruleWithPerms({ paused: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Pause/i })).toBeInTheDocument();
  });

  it('shows Resume in More menu when rule is paused', async () => {
    renderActions(baseHit(), ruleWithPerms({ paused: true }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Resume/i })).toBeInTheDocument();
  });

  it('hides Pause and Delete from More menu when user has no write/delete permission', async () => {
    renderActions(baseHit(), ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows Delete confirmation dialog on Delete click', async () => {
    renderActions(baseHit(), ruleWithPerms());

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete "CPU high"?');
  });

  it('hides Edit and Pause/Delete for provisioned rules', async () => {
    renderActions(baseHit(), ruleWithPerms({ isProvisioned: true }));

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('menuitem', { name: /Pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('always shows View, Duplicate and Copy link in More menu', async () => {
    renderActions(baseHit(), ruleWithPerms({ canWrite: false, canDelete: false }));

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /View/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument();
  });

  it('calls PATCH to delete the rule after confirmation', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/alertrules/:name`, () => {
        deleteCalled = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );

    renderActions(baseHit(), ruleWithPerms());
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Delete/i }));

    expect(deleteCalled).toBe(true);
  });
});
