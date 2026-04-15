import { waitFor } from '@testing-library/react';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getSearchTeamsErrorHandler, getSearchTeamsHandler } from '@grafana/test-utils/handlers';
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

  it('does not show the all teams option when totalCount is more than 200 and shows a warning', async () => {
    server.use(
      getSearchTeamsHandler(
        [
          { id: 1, uid: 'team-a', name: 'Team A', avatarUrl: '' },
          { id: 2, uid: 'test-team', name: 'Test Team', avatarUrl: '' },
        ],
        201
      )
    );

    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));

    await waitFor(() => {
      expect(screen.queryByText('All teams')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Test Team')).toBeInTheDocument();

    await user.hover(await screen.findByLabelText('Owner filter limit warning'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Listing only first 200 teams out of 201.');
  });

  it('shows an error tooltip when loading teams fails', async () => {
    server.use(getSearchTeamsErrorHandler('Team API unavailable'));

    const { user } = render(<OwnersFilter values={[]} onChange={jest.fn()} />);

    await user.hover(await screen.findByLabelText('Owner filter load error'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Team API unavailable');
  });
});
