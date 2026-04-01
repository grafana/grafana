import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getSearchTeamsHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { OwnersFilter } from './OwnersFilter';

setBackendSrv(backendSrv);
setupMockServer();
comboboxTestSetup();

describe('OwnersFilter', () => {
  beforeEach(() => {
    server.use(
      getSearchTeamsHandler([
        { id: 1, uid: 'team-a', name: 'Team A', avatarUrl: '' },
        { id: 2, uid: 'test-team', name: 'Test Team', avatarUrl: '' },
      ])
    );
  });

  it('shows the all teams option and fetched teams', async () => {
    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));

    expect(await screen.findByText('All teams')).toBeInTheDocument();
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

  it('normalizes the all teams option into all ownerReference values', async () => {
    const onChange = jest.fn();
    const { user } = render(<OwnersFilter values={[]} onChange={onChange} />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));
    await user.click(await screen.findByText('All teams'));

    expect(onChange).toHaveBeenCalledWith(['iam.grafana.app/Team/team-a', 'iam.grafana.app/Team/test-team']);
  });
});
