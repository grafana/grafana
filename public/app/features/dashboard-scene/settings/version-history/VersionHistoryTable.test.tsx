import { render, screen, fireEvent } from '@testing-library/react';

import { DashboardInteractions } from '../../utils/interactions';
import { DecoratedRevisionModel } from '../VersionsEditView';

import { VersionHistoryTable } from './VersionHistoryTable';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    versionRestoreClicked: jest.fn(),
    showMoreVersionsClicked: jest.fn(),
  },
}));

const mockVersions: DecoratedRevisionModel[] = [
  {
    id: 1,
    version: 1,
    createdDateString: '2023-01-01',
    createdBy: 'User1',
    message: 'Initial version',
    checked: false,
    uid: '0',
    parentVersion: 0,
    created: new Date(),
    data: { schemaVersion: 1, uid: '0', title: 'Dashboard', panels: [] },
    ageString: '1 day ago',
  },
  {
    id: 2,
    version: 2,
    createdDateString: '2023-02-01',
    createdBy: 'User2',
    message: 'Second version',
    checked: false,
    uid: '0',
    parentVersion: 0,
    created: new Date(),
    data: { schemaVersion: 1, uid: '0', title: 'Dashboard', panels: [] },
    ageString: '10 days ago',
  },
];

describe('VersionHistoryTable', () => {
  it('triggers a user event when the restore button is clicked', async () => {
    render(<VersionHistoryTable versions={mockVersions} canCompare={true} onCheck={jest.fn()} onRestore={jest.fn()} />);

    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);

    expect(DashboardInteractions.versionRestoreClicked).toHaveBeenCalledWith({
      version: mockVersions[1].version,
      index: 1,
      confirm: false,
      version_date: mockVersions[1].created,
    });
  });
});
