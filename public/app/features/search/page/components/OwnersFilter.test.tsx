import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { type FeatureToggles } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { getSearchTeamsErrorHandler } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { OwnersFilter } from './OwnersFilter';

setBackendSrv(backendSrv);
const server = setupMockServer();

const toggle: Array<keyof FeatureToggles> = ['kubernetesTeamsApi'];

describe.each([
  { name: 'IAM path', toggles: { enable: toggle } },
  { name: 'legacy path', toggles: { disable: toggle } },
])('OwnersFilter ($name)', ({ toggles }) => {
  testWithFeatureToggles(toggles);

  it('shows fetched teams when opened', async () => {
    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));

    expect(await screen.findByText('Team A')).toBeInTheDocument();
    expect(await screen.findByText('Test Team')).toBeInTheDocument();
  });

  it('normalizes a team selection into ownerReference values', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnersFilter values={[]} onChange={onChange} />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));
    await user.click(await screen.findByText('Team A'));

    expect(onChange).toHaveBeenCalledWith(['iam.grafana.app/Team/team-a']);
  });

  it('searches teams with the typed query', async () => {
    const queries: string[] = [];

    const captureQuery = ({ request }: { request: Request }) => {
      const query = new URL(request.url).searchParams.get('query') ?? '';
      queries.push(query);
    };

    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', captureQuery),
      http.get('/api/teams/search', captureQuery)
    );

    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    const combobox = await screen.findByRole('combobox', { name: 'Owner filter' });
    await user.click(combobox);
    await user.type(combobox, 'm A');

    expect(await screen.findByText('Team A')).toBeInTheDocument();
    await waitFor(() => expect(queries).toContain('m A'));
  });

  it('shows labels for pre-selected teams', async () => {
    render(<OwnersFilter values={['iam.grafana.app/Team/team-a']} onChange={jest.fn()} />);

    expect(await screen.findByText('Team A')).toBeInTheDocument();
  });

  it('shows a fallback label for pre-selected teams that cannot be loaded', async () => {
    render(<OwnersFilter values={['iam.grafana.app/Team/does-not-exist']} onChange={jest.fn()} />);

    expect(await screen.findByText('[Unknown team]')).toBeInTheDocument();
  });

  it('shows an error tooltip when loading teams fails', async () => {
    server.use(
      getSearchTeamsErrorHandler('Team API unavailable'),
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', () =>
        HttpResponse.json({ message: 'Team API unavailable' }, { status: 500 })
      )
    );

    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    await user.hover(await screen.findByLabelText('Owner filter load error'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Team API unavailable');
  });
});
