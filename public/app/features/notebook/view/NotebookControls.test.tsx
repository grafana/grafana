import { getWrapper, render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { DashboardControls } from 'app/features/dashboard-scene/scene/DashboardControls';

import { NotebookControls } from './NotebookControls';
import { NotebookEditModeProvider } from './NotebookEditModeContext';

function setup({
  canEdit = true,
  initialUrl = '/notebooks/nb1',
  controls,
}: { canEdit?: boolean; initialUrl?: string; controls?: DashboardControls } = {}) {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(canEdit);

  const Wrapper = getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [initialUrl] } });

  return render(
    <Wrapper>
      <NotebookEditModeProvider>
        <NotebookControls controls={controls} />
      </NotebookEditModeProvider>
    </Wrapper>,
    // The wrapper above already supplies the router; letting render add another would nest two.
    { renderWithRouter: false }
  );
}

describe('NotebookControls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers the toggle to a user who can edit', () => {
    setup({ canEdit: true });

    expect(screen.getByRole('switch', { name: 'Edit' })).toBeInTheDocument();
  });

  it('hides the toggle from a user who cannot edit', () => {
    setup({ canEdit: false });

    expect(screen.queryByRole('switch', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('says when the notebook is being edited', async () => {
    const { user } = setup({ canEdit: true });

    expect(screen.queryByText('Editing')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Edit' }));

    expect(await screen.findByText('Editing')).toBeInTheDocument();
  });

  it('reflects edit mode arrived at through the url', () => {
    setup({ canEdit: true, initialUrl: '/notebooks/nb1?edit=true' });

    expect(screen.getByRole('switch', { name: 'Edit' })).toBeChecked();
    expect(screen.getByText('Editing')).toBeInTheDocument();
  });

  it('keeps the toggle when the notebook hides its time controls', () => {
    // The pickers and the toggle are independent: a notebook without a time range still gets the
    // view/edit switch.
    const controls = new DashboardControls({ hideTimeControls: true });

    setup({ canEdit: true, controls });

    expect(screen.getByRole('switch', { name: 'Edit' })).toBeInTheDocument();
  });
});
