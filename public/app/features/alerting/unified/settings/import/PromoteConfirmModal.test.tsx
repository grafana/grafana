import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

import { setupMswServer } from '../../mockApi';
import { type AdminConfigPostState, setupAdminConfigPost } from '../../mocks/server/configure/admin_config';

import { PromoteConfirmModal, getPreviewState } from './PromoteConfirmModal';

const server = setupMswServer();

// Toasts render outside this tree, so assert on the notification calls instead.
const notify = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => notify,
}));

const stagedConfig = {
  identifier: 'config-min',
  alertmanager_config: 'route:\n  receiver: default\nreceivers:\n  - name: default\n',
  template_files: {},
};

const CONVERT_URL = '/api/convert/api/v1/alerts';
const PROMOTE_URL = '/api/convert/api/v1/alerts/:identifier/promote';

const ui = {
  mergeHeading: byText(/will merge into your live config/i),
  confirm: byRole('button', { name: /promote to live config/i }),
};

/** Dry-run response with a full merge preview and two renamed resources. */
function fullDryRunResponse() {
  return HttpResponse.json({
    status: 'success',
    stats: {
      added_receivers: ['a', 'b', 'c', 'd', 'e', 'f'],
      added_templates: ['t1', 't2', 't3', 't4'],
      added_time_intervals: ['i1', 'i2'],
      added_inhibition_rules: ['r1', 'r2', 'r3'],
      added_route: 'imported-prod',
    },
    rename_resources: {
      receivers: { 'pagerduty-critical': 'pagerduty-critical-1' },
      time_intervals: { weekends: 'weekends-1' },
    },
  });
}

describe('getPreviewState', () => {
  const validResult = { valid: true, renamedReceivers: [], renamedTimeIntervals: [] };
  const invalidResult = { valid: false, error: 'nope', renamedReceivers: [], renamedTimeIntervals: [] };

  it('reports loading while the dry-run is in flight, regardless of other fields', () => {
    expect(getPreviewState({ isLoading: true, isPreviewUnavailable: false })).toEqual({ kind: 'loading' });
  });

  it('reports unavailable for a dry-run error caused by a sync/permission gate', () => {
    expect(getPreviewState({ isLoading: false, error: 'blocked', isPreviewUnavailable: true })).toEqual({
      kind: 'unavailable',
    });
  });

  it('reports error for a dry-run failure unrelated to the preview gates', () => {
    expect(getPreviewState({ isLoading: false, error: 'server error', isPreviewUnavailable: false })).toEqual({
      kind: 'error',
      message: 'server error',
    });
  });

  it('reports invalid with the backend error when the dry-run succeeds but the config is invalid', () => {
    expect(getPreviewState({ isLoading: false, isPreviewUnavailable: false, result: invalidResult })).toEqual({
      kind: 'invalid',
      message: 'nope',
    });
  });

  it('reports valid with the result when the dry-run succeeds and the config can be promoted', () => {
    expect(getPreviewState({ isLoading: false, isPreviewUnavailable: false, result: validResult })).toEqual({
      kind: 'valid',
      result: validResult,
    });
  });

  it('reports idle before the dry-run has settled (no error, no result, not loading)', () => {
    expect(getPreviewState({ isLoading: false, isPreviewUnavailable: false })).toEqual({ kind: 'idle' });
  });
});

describe('PromoteConfirmModal', () => {
  let appEventsEmitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    appEventsEmitSpy = jest.spyOn(appEvents, 'emit').mockImplementation();
  });

  afterEach(() => {
    appEventsEmitSpy.mockRestore();
  });

  it('previews the merge impact and renamed resources from the dry-run, then promotes on confirm', async () => {
    let promoted = false;
    server.use(
      http.post(CONVERT_URL, fullDryRunResponse),
      http.post(PROMOTE_URL, () => {
        promoted = true;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const onDismiss = jest.fn();
    const { user } = render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    // Impact preview: a heading + one row per resource type present (only the types with a count).
    await ui.mergeHeading.find();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('6 contact points added');
    expect(dialog).toHaveTextContent('4 templates added');
    expect(dialog).toHaveTextContent('2 time intervals added');
    expect(dialog).toHaveTextContent('3 inhibition rules added');
    expect(dialog).toHaveTextContent('1 notification route added');

    // Rename-to-avoid-conflicts list and the "rules already active" note.
    expect(dialog).toHaveTextContent('Renamed to avoid conflicts');
    expect(dialog).toHaveTextContent('pagerduty-critical-1');
    expect(dialog).toHaveTextContent('weekends-1');
    expect(dialog).toHaveTextContent(/already active as Grafana-managed rules/i);

    // Confirm merges via the dedicated promote endpoint and closes the modal.
    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());
    await user.click(ui.confirm.get());

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(promoted).toBe(true);
  });

  it('clears the configured auto-sync datasource after promoting a sync-managed config', async () => {
    const adminConfig: AdminConfigPostState = { lastPayload: null };
    server.use(
      http.post(CONVERT_URL, fullDryRunResponse),
      http.post(PROMOTE_URL, () => HttpResponse.json({}))
    );
    setupAdminConfigPost(server, adminConfig, 201);

    const onDismiss = jest.fn();
    const { user } = render(<PromoteConfirmModal stagedConfig={stagedConfig} isSyncManaged onDismiss={onDismiss} />);

    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());
    await user.click(ui.confirm.get());

    // Empty UID is the backend's "clear it" convention; without it auto-sync stays reported as
    // active and the convert API keeps rejecting notification imports.
    await waitFor(() => expect(adminConfig.lastPayload).toEqual({ external_alertmanager_uid: '' }));
    expect(notify.success).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('leaves the auto-sync configuration alone when the staged config is not sync-managed', async () => {
    const adminConfig: AdminConfigPostState = { lastPayload: null };
    server.use(
      http.post(CONVERT_URL, fullDryRunResponse),
      http.post(PROMOTE_URL, () => HttpResponse.json({}))
    );
    setupAdminConfigPost(server, adminConfig, 201);

    const onDismiss = jest.fn();
    const { user } = render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());
    await user.click(ui.confirm.get());

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(adminConfig.lastPayload).toBeNull();
  });

  it('reports a promote that succeeded but could not clear auto-sync as a warning, not a failure', async () => {
    const adminConfig: AdminConfigPostState = { lastPayload: null };
    server.use(
      http.post(CONVERT_URL, fullDryRunResponse),
      http.post(PROMOTE_URL, () => HttpResponse.json({}))
    );
    // 409 is the operator-managed (grafana.ini) case: the UID can never be cleared through the API.
    setupAdminConfigPost(server, adminConfig, 409, { message: 'managed by the operator' });

    const onDismiss = jest.fn();
    const { user } = render(<PromoteConfirmModal stagedConfig={stagedConfig} isSyncManaged onDismiss={onDismiss} />);

    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());
    await user.click(ui.confirm.get());

    await waitFor(() => expect(notify.warning).toHaveBeenCalled());
    expect(notify.error).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('surfaces a validation error and keeps promote disabled when the dry-run is invalid', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'error', error: 'invalid config' })));

    const onDismiss = jest.fn();
    render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    expect(await screen.findByText(/can.t be promoted/i)).toBeInTheDocument();
    expect(screen.getByText('invalid config')).toBeInTheDocument();
    expect(ui.confirm.get()).toBeDisabled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.each([
    ['a sync gate', 409],
    ['a stricter preview-only permission check', 403],
  ])('allows promote when the dry-run preview is blocked by %s (%d)', async (_reason, status) => {
    server.use(
      http.post(CONVERT_URL, () => HttpResponse.json({ message: 'blocked' }, { status })),
      http.post(PROMOTE_URL, () => HttpResponse.json({ status: 'success' }))
    );

    const onDismiss = jest.fn();
    const { user } = render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    expect(await screen.findByText(/couldn.t preview the promotion impact/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t check the promotion impact/i)).not.toBeInTheDocument();
    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());

    // backendSrv schedules its global toast 50ms after a failed request settles, so give it a
    // chance to fire before asserting it didn't.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(appEventsEmitSpy).not.toHaveBeenCalledWith(AppEvents.alertWarning, expect.anything());
    expect(appEventsEmitSpy).not.toHaveBeenCalledWith(AppEvents.alertError, expect.anything());

    await user.click(ui.confirm.get());
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it('keeps promote disabled and shows the error banner for a dry-run failure unrelated to the preview gates', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ message: 'server error' }, { status: 500 })));

    const onDismiss = jest.fn();
    render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    expect(await screen.findByText(/couldn.t check the promotion impact/i)).toBeInTheDocument();
    expect(ui.confirm.get()).toBeDisabled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
