import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { type FeatureToggles } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { backendSrv } from '../../services/backend_srv';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';

setBackendSrv(backendSrv);
const server = setupMockServer();
mockComboboxRect();

const toggle: Array<keyof FeatureToggles> = ['kubernetesTeamsApi'];

describe.each([
  { name: 'IAM path', toggles: { enable: toggle } },
  { name: 'legacy path', toggles: { disable: toggle } },
])('OwnerReferenceSelector ($name)', ({ toggles }) => {
  testWithFeatureToggles(toggles);

  it('shows load error but keeps selector interactive', async () => {
    const { getByRole, findByText } = render(
      <OwnerReferenceSelector onChange={jest.fn()} defaultTeamUids={['team-non-existent']} />
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

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        apiVersion: 'iam.grafana.app/v0alpha1',
        kind: 'Team',
        name: expect.any(String),
        uid: expect.any(String),
      }),
    ]);
  });

  it('allows selecting multiple teams as owners', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnerReferenceSelector onChange={onChange} />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.type(combobox, 'Test');
    await user.click(await screen.findByRole('option', { name: 'Test Team' }));

    await user.clear(combobox);
    await user.type(combobox, 'Team A');
    await user.click(await screen.findByRole('option', { name: 'Team A' }));

    const lastArg = onChange.mock.calls.at(-1)?.[0];
    expect(lastArg).toHaveLength(2);
    expect(lastArg).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'Team', uid: 'team-a' })]));
  });

  it('seeds the selector with the provided default teams', async () => {
    render(<OwnerReferenceSelector onChange={jest.fn()} defaultTeamUids={['team-a']} />);

    expect(await screen.findByText('Team A')).toBeInTheDocument();
  });

  it('allows clearing all selected owner teams and emits an empty list', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnerReferenceSelector onChange={onChange} defaultTeamUids={['team-a']} />);

    expect(await screen.findByText('Team A')).toBeInTheDocument();

    await user.click(await screen.findByTitle('Clear all'));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('remains interactive when no teams exist', async () => {
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', () => {
        return HttpResponse.json({ totalHits: 0, hits: [] });
      }),
      http.get('/api/teams/search', () => {
        return HttpResponse.json({ totalCount: 0, teams: [], page: 1, perPage: 1000 });
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

    const captureQuery = ({ request }: { request: Request }) => {
      const query = new URL(request.url).searchParams.get('query') ?? '';
      queries.push(query);
    };

    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', captureQuery),
      http.get('/api/teams/search', captureQuery)
    );

    const { user } = render(<OwnerReferenceSelector onChange={jest.fn()} />);
    const combobox = screen.getByRole('combobox');

    await user.click(combobox);
    await user.type(combobox, 'm A');

    expect(await screen.findByRole('option', { name: 'Team A' })).toBeInTheDocument();
    await waitFor(() => expect(queries).toContain('m A'));
  });
});
