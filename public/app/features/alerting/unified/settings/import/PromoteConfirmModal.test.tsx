import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setupMswServer } from '../../mockApi';

import { PromoteConfirmModal } from './PromoteConfirmModal';

const server = setupMswServer();

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

describe('PromoteConfirmModal', () => {
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

  it('promotes only once when the user submits the confirm button twice', async () => {
    let promoteCount = 0;

    server.use(
      http.post(CONVERT_URL, fullDryRunResponse),
      http.post(PROMOTE_URL, () => {
        promoteCount++;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const onDismiss = jest.fn();
    render(<PromoteConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    await waitFor(() => expect(ui.confirm.get()).toBeEnabled());

    // Both clicks must land before React re-renders the button as disabled; userEvent would flush
    // between them and miss the race. See useSingleFlight for why the two submits overlap at all.
    await act(async () => {
      ui.confirm.get().click();
      ui.confirm.get().click();
    });

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(promoteCount).toBe(1);
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
});
