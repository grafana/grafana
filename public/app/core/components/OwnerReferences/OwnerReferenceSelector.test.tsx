import { HttpResponse, http } from 'msw';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen, waitFor, within } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { backendSrv } from '../../services/backend_srv';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';

setBackendSrv(backendSrv);
const server = setupMockServer();
comboboxTestSetup();

describe('OwnerReferenceSelector', () => {
  it('shows load error but keeps selector interactive', async () => {
    const { getByRole, findByText } = render(
      <OwnerReferenceSelector onChange={jest.fn()} defaultTeamUid="team-non-existent" />
    );

    expect(getByRole('combobox')).toBeInTheDocument();
    expect(await findByText('Could not load team details')).toBeInTheDocument();
  });

  it('shows retrieved teams in the select and allows selecting a team', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnerReferenceSelector onChange={onChange} />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.type(combobox, 'Test');

    await user.click(await screen.findByRole('option', { name: 'Test Team' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        apiVersion: 'iam.grafana.app/v0alpha1',
        kind: 'Team',
        // Name == uid, we don't send label here
        name: expect.any(String),
        uid: expect.any(String),
      })
    );
  });

  it('allows clearing an already selected owner team and saving null owner reference', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnerReferenceSelector onChange={onChange} defaultTeamUid="team-a" />);
    const combobox = screen.getByRole('combobox');

    await waitFor(() => expect(combobox).toHaveValue('Team A'));

    const selectorContainer = combobox.closest('div');
    expect(selectorContainer).not.toBeNull();
    await user.click(within(selectorContainer!).getByTitle('Clear value'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('remains interactive when no teams exist', async () => {
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', () => {
        return HttpResponse.json({ totalHits: 0, hits: [] });
      })
    );

    const { user } = render(<OwnerReferenceSelector onChange={jest.fn()} />);

    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeEnabled();

    await user.click(combobox);
    await user.type(combobox, 'does-not-exist');

    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
  });

  it('searches teams by typed query string', async () => {
    const queries: string[] = [];

    // This just checks if we call the api with the right param and then passes it to the regular handler
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query') ?? '';
        queries.push(query);
      })
    );

    const { user } = render(<OwnerReferenceSelector onChange={jest.fn()} />);
    const combobox = screen.getByRole('combobox');

    await user.click(combobox);
    await user.type(combobox, 'm A');

    expect(await screen.findByRole('option', { name: 'Team A' })).toBeInTheDocument();
    await waitFor(() => expect(queries).toContain('m A'));
  });
});
