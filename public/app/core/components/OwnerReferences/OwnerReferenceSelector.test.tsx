import { render, waitFor } from 'test/test-utils';

import { useLazyGetSearchTeamsQuery, useLazyGetTeamQuery } from 'app/api/clients/iam/v0alpha1';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/iam/v0alpha1'),
  useLazyGetSearchTeamsQuery: jest.fn(),
  useLazyGetTeamQuery: jest.fn(),
}));

const useLazyGetSearchTeamsQueryMock = useLazyGetSearchTeamsQuery as jest.Mock;
const useLazyGetTeamQueryMock = useLazyGetTeamQuery as jest.Mock;

describe('OwnerReferenceSelector', () => {
  beforeEach(() => {
    useLazyGetSearchTeamsQueryMock.mockReturnValue([jest.fn(), { isLoading: false }]);
    useLazyGetTeamQueryMock.mockReturnValue([
      jest.fn().mockReturnValue({ unwrap: () => Promise.resolve({ metadata: {}, spec: {} }) }),
      { isLoading: false, error: undefined },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows load error but keeps selector interactive', async () => {
    const triggerGetTeam = jest.fn().mockReturnValue({
      unwrap: () => Promise.resolve({ metadata: { name: 'team-a' }, spec: { title: 'Team A' } }),
    });
    useLazyGetTeamQueryMock.mockReturnValue([triggerGetTeam, { isLoading: false, error: new Error('not found') }]);

    const { getByRole, findByText } = render(<OwnerReferenceSelector onChange={jest.fn()} defaultTeamUid="team-a" />);

    await waitFor(() => {
      expect(triggerGetTeam).toHaveBeenCalledWith({ name: 'team-a' }, true);
    });
    expect(getByRole('combobox')).toBeInTheDocument();
    expect(await findByText('Could not load team details')).toBeInTheDocument();
  });
});
