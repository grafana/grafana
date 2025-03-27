import { render, screen, fireEvent } from '@testing-library/react';

import { DashboardInteractions } from '../../utils/interactions';

import { VersionsHistoryButtons } from './VersionHistoryButtons';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    showMoreVersionsClicked: jest.fn(),
  },
}));

describe('VersionHistoryButtons', () => {
  it('triggers a user event when the show more versions is clicked', async () => {
    render(
      <VersionsHistoryButtons
        getVersions={jest.fn()}
        canCompare={true}
        hasMore={true}
        getDiff={jest.fn()}
        isLastPage={false}
      />
    );

    const showMoreButton = screen.getByText('Show more versions');
    fireEvent.click(showMoreButton);

    expect(DashboardInteractions.showMoreVersionsClicked).toHaveBeenCalledWith();
  });
});
