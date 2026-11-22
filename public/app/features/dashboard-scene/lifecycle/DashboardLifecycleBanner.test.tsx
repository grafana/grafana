import { render, screen } from 'test/test-utils';

import { defaultPanelSpec, defaultSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardLifecycleBanner } from './DashboardLifecycleBanner';
import { getSavedDashboard } from './lifecycleApi';
import { type DashboardPendingChanges, getPendingChangePreview } from './pendingChangePreview';
import { usePendingChangeDiff } from './usePendingChangeDiff';

jest.mock('./lifecycleApi', () => ({
  ...jest.requireActual('./lifecycleApi'),
  getSavedDashboard: jest.fn(),
}));

jest.mock('./pendingChangePreview', () => ({
  ...jest.requireActual('./pendingChangePreview'),
  getPendingChangePreview: jest.fn(),
}));

jest.mock('./usePendingChangeDiff', () => ({
  usePendingChangeDiff: jest.fn(() => ({ changes: [], baseSpec: undefined })),
}));

jest.mock('./useChangeHighlights', () => ({
  ...jest.requireActual('./useChangeHighlights'),
  useChangeHighlights: () => [],
}));

const pending: DashboardPendingChanges = {
  baseGeneration: 3,
  // The diff is mocked, so the banner never reads the proposed spec.
  proposed: {} as DashboardPendingChanges['proposed'],
  source: 'made by Assistant',
  apply: jest.fn(),
  discard: jest.fn(),
};

function renderBanner({ canEdit }: { canEdit: boolean }) {
  jest.mocked(getSavedDashboard).mockResolvedValue({
    title: 'Random Data Demo',
    generation: 3,
    canEdit,
    url: '/d/donp4hf/random-data-demo',
    spec: {},
  });
  jest.mocked(getPendingChangePreview).mockReturnValue({ id: 'chat-1', pending, previewing: true });
  // viewers_can_edit: a viewer can change the scene without being allowed to save it.
  const dashboard = new DashboardScene({
    uid: 'donp4hf',
    title: 'Random Data Demo',
    meta: { canEdit: true, canSave: canEdit },
  });
  return render(<DashboardLifecycleBanner dashboard={dashboard} />);
}

describe('DashboardLifecycleBanner', () => {
  it('explains that saving needs permission to save, for a requester who can edit but not save', async () => {
    const { user } = renderBanner({ canEdit: false });

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.hover(save);
    expect(
      await screen.findByText(
        'You don’t have permission to save “Random Data Demo”, so you can preview these changes but not save them. Ask an admin for permission to save it.'
      )
    ).toBeInTheDocument();
  });

  it('scrolls to a changed grid slot before its panel has mounted', async () => {
    const panel = { kind: 'Panel' as const, spec: { ...defaultPanelSpec(), id: 100, title: 'Before' } };
    const baseSpec = { ...defaultSpec(), elements: { 'panel-100': panel } };
    const proposed = {
      ...baseSpec,
      elements: { 'panel-100': { ...panel, spec: { ...panel.spec, title: 'Offscreen chart' } } },
    };
    jest.mocked(usePendingChangeDiff).mockReturnValue({ changes: [], baseSpec });
    jest.mocked(getPendingChangePreview).mockReturnValue({
      id: 'chat-1',
      pending: { ...pending, proposed },
      previewing: true,
    });
    jest.mocked(getSavedDashboard).mockResolvedValue({
      title: 'Random Data Demo',
      generation: 3,
      canEdit: true,
      url: '/d/donp4hf/random-data-demo',
      spec: baseSpec,
    });
    const dashboard = new DashboardScene({ uid: 'donp4hf', title: 'Random Data Demo' });
    const { user } = render(
      <div data-dashboard-view>
        <DashboardLifecycleBanner dashboard={dashboard} placement="embedded" />
        <div data-griditem-key="grid-item-100">Grid slot</div>
      </div>
    );
    const slot = screen.getByText('Grid slot');
    const scrollIntoView = jest.fn();
    slot.scrollIntoView = scrollIntoView;

    try {
      await user.click(screen.getByRole('button', { name: 'Compare' }));
      await user.click(await screen.findByRole('button', { name: /Offscreen chart/ }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    } finally {
      jest.mocked(usePendingChangeDiff).mockReset().mockReturnValue({ changes: [], baseSpec: undefined });
    }
  });

  it('lets a requester who can save save the changes', async () => {
    renderBanner({ canEdit: true });

    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
