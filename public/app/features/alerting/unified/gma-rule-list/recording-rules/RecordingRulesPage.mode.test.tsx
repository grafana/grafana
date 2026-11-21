import { act, render, screen } from 'test/test-utils';

import * as runtime from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';

import RecordingRulesPage from './RecordingRulesPage';
import { setup } from './recordingRulesPageFixture';

setupMswServer();

function viewParam() {
  return new URLSearchParams(runtime.locationService.getLocation().search).get('view');
}

describe('RecordingRulesPage Folders and List modes', () => {
  it('switches to List for free text, keeps the folder filter, and disables Folders until it is cleared', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />, {
      historyOptions: {
        initialEntries: ['/?search=folder%3A%22Team%20Metrics%22'],
      },
    });
    await screen.findByRole('link', { name: 'Team Metrics' });

    await user.type(screen.getByRole('textbox', { name: 'Search' }), ' cpu{Enter}');

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'disk:usage:rate5m' })).not.toBeInTheDocument();
    // A non-folder filter forces List on its own; `view` keeps only a mode the user chose.
    expect(viewParam()).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('folder:"Team Metrics" cpu');
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Folders' })).toHaveAccessibleDescription(
      'Clear filters to browse by folder'
    );

    await user.hover(screen.getByText('Folders'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear filters to browse by folder');
  });

  it('switches between Folders and List with the toggle, writing the view to the URL', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    await screen.findByRole('link', { name: 'Team Metrics' });

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(await screen.findByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(viewParam()).toBe('list');

    await user.click(screen.getByRole('radio', { name: 'Folders' }));

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
    expect(viewParam()).toBeNull();
  });

  it('Back and Forward restore Folders and List as the view changes', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    await screen.findByRole('link', { name: 'Team Metrics' });
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await screen.findByRole('link', { name: 'cpu:usage:rate5m' });

    act(() => runtime.locationService.getHistory().goBack());

    expect(await screen.findByRole('button', { name: 'Expand Team Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(viewParam()).toBeNull();

    act(() => runtime.locationService.getHistory().goForward());

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(viewParam()).toBe('list');
  });
});
