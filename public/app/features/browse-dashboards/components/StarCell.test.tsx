import { type CellProps } from 'react-table';
import { render, screen } from 'test/test-utils';

import { getFolderFixtures } from '@grafana/test-utils/unstable';

import { type DashboardsTreeItem } from '../types';

import { StarCell } from './StarCell';

jest.mock('app/features/stars/StarToolbarButton', () => ({
  StarToolbarButton: (props: { group: string; kind: string; id: string }) => (
    <div data-testid="star-toolbar-button" data-group={props.group} data-kind={props.kind} data-id={props.id} />
  ),
}));

const [_, { folderA: folder, dashbdD: dashboard }] = getFolderFixtures();

const renderCell = (treeItem: DashboardsTreeItem) =>
  // StarCell only reads row.original; the rest of CellProps is unused
  render(<StarCell {...({ row: { original: treeItem } } as CellProps<DashboardsTreeItem, unknown>)} />);

describe('StarCell', () => {
  it('stars a folder through the dashboard star mechanism (folders share the dashboard star backing)', () => {
    renderCell(folder);

    const button = screen.getByTestId('star-toolbar-button');
    expect(button).toHaveAttribute('data-group', 'dashboard.grafana.app');
    expect(button).toHaveAttribute('data-kind', 'Dashboard');
    expect(button).toHaveAttribute('data-id', folder.item.uid);
  });

  it('does not render a star button for a dashboard row', () => {
    renderCell(dashboard);

    expect(screen.queryByTestId('star-toolbar-button')).not.toBeInTheDocument();
  });
});
