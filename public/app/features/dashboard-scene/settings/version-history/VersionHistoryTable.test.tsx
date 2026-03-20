import { render, screen, fireEvent } from '@testing-library/react';

import { DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';

import { DashboardInteractions } from '../../utils/interactions';

import { VersionHistoryTable } from './VersionHistoryTable';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    versionRestoreClicked: jest.fn(),
    showMoreVersionsClicked: jest.fn(),
  },
}));

function createMockResource(version: number, spec: object) {
  return {
    apiVersion: 'v0alpha1',
    kind: 'Dashboard',
    metadata: { name: '0', generation: version, resourceVersion: '0', creationTimestamp: '' },
    spec,
  };
}

function makeVersion(overrides: Partial<DecoratedRevisionModel> & { id: number; version: number }): DecoratedRevisionModel {
  return {
    createdDateString: '2023-01-01',
    createdBy: 'User1',
    message: '',
    checked: false,
    uid: '0',
    created: '2023-01-01T00:00:00Z',
    data: createMockResource(overrides.version, { schemaVersion: 1, uid: '0', title: 'Dashboard', panels: [] }),
    ageString: '1 day ago',
    versionType: 'manual',
    ...overrides,
  };
}

const mockVersions: DecoratedRevisionModel[] = [
  makeVersion({ id: 1, version: 1, message: 'Initial version' }),
  makeVersion({ id: 2, version: 2, createdBy: 'User2', message: 'Second version', createdDateString: '2023-02-01', created: '2023-02-01T00:00:00Z', ageString: '10 days ago' }),
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
      version_date: new Date(mockVersions[1].created),
    });
  });

  it('does not show toggle when there are no auto-saves', () => {
    render(<VersionHistoryTable versions={mockVersions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    expect(screen.queryByTestId('show-auto-saves-toggle')).not.toBeInTheDocument();
  });

  it('shows toggle when there are auto-save versions', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, message: 'Manual save' }),
      makeVersion({ id: 2, version: 2, versionType: 'auto', message: '' }),
    ];

    render(<VersionHistoryTable versions={versions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    expect(screen.getByTestId('show-auto-saves-toggle')).toBeInTheDocument();
  });

  it('hides auto-save versions by default', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, message: 'Manual save' }),
      makeVersion({ id: 2, version: 2, versionType: 'auto', message: 'Auto-saved' }),
      makeVersion({ id: 3, version: 3, message: 'Another manual' }),
    ];

    render(<VersionHistoryTable versions={versions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    const rows = screen.getAllByTestId('version-row');
    expect(rows).toHaveLength(2); // Only manual versions
    expect(screen.queryByText('Auto-saved')).not.toBeInTheDocument();
  });

  it('shows auto-save versions when toggle is enabled', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, message: 'Manual save' }),
      makeVersion({ id: 2, version: 2, versionType: 'auto', message: 'Auto-saved' }),
    ];

    render(<VersionHistoryTable versions={versions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    // Toggle the switch
    fireEvent.click(screen.getByTestId('show-auto-saves-toggle'));

    const rows = screen.getAllByTestId('version-row');
    expect(rows).toHaveLength(2); // Both versions
    expect(screen.getByText('Auto-saved')).toBeInTheDocument();
  });

  it('shows "auto" tag on auto-save rows when visible', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, message: 'Manual save' }),
      makeVersion({ id: 2, version: 2, versionType: 'auto', message: 'Auto' }),
    ];

    render(<VersionHistoryTable versions={versions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    // Toggle on to see auto versions
    fireEvent.click(screen.getByTestId('show-auto-saves-toggle'));

    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('treats versions without versionType as manual', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, versionType: undefined }),
      makeVersion({ id: 2, version: 2, versionType: 'auto' }),
    ];

    render(<VersionHistoryTable versions={versions} canCompare={false} onCheck={jest.fn()} onRestore={jest.fn()} />);

    // Auto-save toggle should appear
    expect(screen.getByTestId('show-auto-saves-toggle')).toBeInTheDocument();

    // Only manual (undefined = manual) version should be visible by default
    const rows = screen.getAllByTestId('version-row');
    expect(rows).toHaveLength(1);
  });
});
