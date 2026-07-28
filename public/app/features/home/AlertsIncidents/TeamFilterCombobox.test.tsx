import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { TeamFilterCombobox } from './TeamFilterCombobox';

setBackendSrv(backendSrv);
setupMockServer();
// The Combobox virtualizes its options; without mocked element rects the
// virtualizer measures 0 height in jsdom and renders no options.
mockComboboxRect();

function mockAlerts(response: () => Response) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', response));
}

describe('TeamFilterCombobox', () => {
  it('renders nothing when no firing alert carries a team label and no team is selected', async () => {
    let requested = false;
    mockAlerts(() => {
      requested = true;
      return HttpResponse.json([]);
    });

    render(<TeamFilterCombobox selectedTeam={undefined} onChange={jest.fn()} userHasTeams={false} />);

    await waitFor(() => expect(requested).toBe(true));
    expect(screen.queryByRole('combobox', { name: /filter alerts by team/i })).not.toBeInTheDocument();
  });

  it('stays visible while a team is selected even when no team labels remain, so the filter can be cleared', async () => {
    mockAlerts(() => HttpResponse.json([]));
    const onChange = jest.fn();

    const { user } = render(<TeamFilterCombobox selectedTeam="Team C" onChange={onChange} userHasTeams />);

    const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });
    expect(combobox).toHaveDisplayValue('Team C');

    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: 'Your teams' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('stays visible while a team is selected even when the options request fails', async () => {
    mockAlerts(() => HttpResponse.json({ message: 'unavailable' }, { status: 500 }));
    const onChange = jest.fn();

    const { user } = render(<TeamFilterCombobox selectedTeam="Team C" onChange={onChange} userHasTeams />);

    const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });
    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: 'Your teams' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
