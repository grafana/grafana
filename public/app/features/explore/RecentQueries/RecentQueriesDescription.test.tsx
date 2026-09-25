import { render, screen } from '@testing-library/react';

import { getRichHistorySettings } from 'app/core/utils/richHistory';

import { RecentQueriesDescription } from './RecentQueriesDescription';

jest.mock('app/core/utils/richHistory', () => ({
  ...jest.requireActual('app/core/utils/richHistory'),
  getRichHistorySettings: jest.fn(),
}));

const getRichHistorySettingsMock = jest.mocked(getRichHistorySettings);

describe('RecentQueriesDescription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reflects the configured retention period', async () => {
    getRichHistorySettingsMock.mockResolvedValue({
      retentionPeriod: 5,
      starredTabAsFirstTab: false,
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: [],
    });

    render(<RecentQueriesDescription />);

    expect(await screen.findByText(/within the past 5 days/i)).toBeInTheDocument();
  });

  it('falls back to the default retention while settings are loading', () => {
    getRichHistorySettingsMock.mockReturnValue(new Promise(() => {}));

    render(<RecentQueriesDescription />);

    expect(screen.getByText(/within the past 14 days/i)).toBeInTheDocument();
  });
});
