import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { contextSrv } from 'app/core/services/context_srv';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { Snapshot } from 'app/features/dashboard/services/SnapshotSrv';
import { AccessControlAction } from 'app/types';

import { SnapshotListTableRow } from './SnapshotListTableRow';

jest.mock('app/core/services/context_srv');
const mockContextSrv = jest.mocked(contextSrv);
const grantAllPermissions = () => {
  grantUserPermissions([AccessControlAction.SnapshotsDelete]);
  mockContextSrv.hasPermissionInMetadata.mockImplementation(() => true);
  mockContextSrv.hasPermission.mockImplementation(() => true);
};
const grantNoPermissions = () => {
  grantUserPermissions([]);
  mockContextSrv.hasPermissionInMetadata.mockImplementation(() => false);
  mockContextSrv.hasPermission.mockImplementation(() => false);
};

describe('SnapshotListTableRow', () => {
  const mockSnapshot = {
    key: 'test',
    name: 'Test Snapshot',
    url: 'http://test.com',
    external: false,
  };

  it('renders correctly', () => {
    const mockOnRemove = jest.fn();
    grantAllPermissions();
    render(
      <table>
        <tbody>
          <SnapshotListTableRow snapshot={mockSnapshot} onRemove={mockOnRemove} />
        </tbody>
      </table>
    );
    expect(screen.getByRole('row')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: mockSnapshot.name })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: mockSnapshot.url })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'External' })).not.toBeInTheDocument();
  });

  it('adds the correct href to the name, url and view buttons', () => {
    const mockOnRemove = jest.fn();
    grantAllPermissions();
    render(
      <table>
        <tbody>
          <SnapshotListTableRow snapshot={mockSnapshot} onRemove={mockOnRemove} />
        </tbody>
      </table>
    );
    const nameLink = screen.getByRole('link', { name: mockSnapshot.name });
    const urlLink = screen.getByRole('link', { name: mockSnapshot.url });
    const viewButton = screen.getByRole('link', { name: 'View' });

    expect(nameLink).toHaveAttribute('href', mockSnapshot.url);
    expect(urlLink).toHaveAttribute('href', mockSnapshot.url);
    expect(viewButton).toHaveAttribute('href', mockSnapshot.url);
  });

  it('calls onRemove when delete button is clicked', async () => {
    const mockOnRemove = jest.fn();
    grantAllPermissions();
    render(
      <table>
        <tbody>
          <SnapshotListTableRow snapshot={mockSnapshot} onRemove={mockOnRemove} />
        </tbody>
      </table>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(mockOnRemove).toHaveBeenCalled();
  });

  it('delete button should be disabled when no permissions', async () => {
    const mockOnRemove = jest.fn();
    grantNoPermissions();
    render(
      <table>
        <tbody>
          <SnapshotListTableRow snapshot={mockSnapshot} onRemove={mockOnRemove} />
        </tbody>
      </table>
    );

    const deleteButton = screen.getByRole('button');
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(deleteButton);
    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  describe('for an external snapshot', () => {
    let mockSnapshotWithExternal: Snapshot;
    const mockOnRemove = jest.fn();

    beforeEach(() => {
      mockSnapshotWithExternal = {
        ...mockSnapshot,
        external: true,
        externalUrl: 'http://external.com',
      };
    });

    it('renders the external badge', () => {
      render(
        <table>
          <tbody>
            <SnapshotListTableRow snapshot={mockSnapshotWithExternal} onRemove={mockOnRemove} />
          </tbody>
        </table>
      );
      expect(screen.getByRole('cell', { name: 'External' })).toBeInTheDocument();
    });

    it('uses the external href for the name, url and view buttons', () => {
      render(
        <table>
          <tbody>
            <SnapshotListTableRow snapshot={mockSnapshotWithExternal} onRemove={mockOnRemove} />
          </tbody>
        </table>
      );
      const nameLink = screen.getByRole('link', { name: mockSnapshotWithExternal.name });
      const urlLink = screen.getByRole('link', { name: mockSnapshotWithExternal.externalUrl });
      const viewButton = screen.getByRole('link', { name: 'View' });

      expect(nameLink).toHaveAttribute('href', mockSnapshotWithExternal.externalUrl);
      expect(urlLink).toHaveAttribute('href', mockSnapshotWithExternal.externalUrl);
      expect(viewButton).toHaveAttribute('href', mockSnapshotWithExternal.externalUrl);
    });
  });
});
