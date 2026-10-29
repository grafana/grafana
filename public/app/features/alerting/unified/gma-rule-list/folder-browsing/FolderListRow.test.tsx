import { type ComponentProps } from 'react';
import { render, screen, within } from 'test/test-utils';

import { FolderListRow } from './FolderListRow';

type RowProps = ComponentProps<typeof FolderListRow>;

function rowUi(overrides: Partial<RowProps> = {}) {
  const props: RowProps = {
    folderUid: 'root',
    title: 'Root',
    parents: [],
    count: '2 alert rules',
    expanded: false,
    onToggle: jest.fn(),
    ...overrides,
  };

  return (
    <ul>
      <FolderListRow {...props} />
    </ul>
  );
}

function renderRow(overrides: Partial<RowProps> = {}) {
  return render(rowUi(overrides));
}

describe('FolderListRow', () => {
  it('shows the own title as a link, the parent path for a nested folder, and the count slot', () => {
    renderRow({
      folderUid: 'k8s',
      title: 'Kubernetes',
      parents: ['Platform', 'Infra'],
      count: '21 alert rules',
    });

    expect(screen.getByRole('link', { name: 'Kubernetes' })).toHaveAttribute(
      'href',
      '/dashboards/f/k8s/kubernetes/alerting'
    );
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(screen.getAllByText('Kubernetes')).toHaveLength(1);
    expect(screen.getByText('21 alert rules')).toBeInTheDocument();
  });

  it('toggles through the chevron button and renders children only while expanded', async () => {
    const onToggle = jest.fn();
    const children = <li>child rule</li>;
    const { user, rerender } = renderRow({ onToggle, children });

    expect(screen.queryByText('child rule')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Root' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(rowUi({ onToggle, children, expanded: true }));
    expect(screen.getByRole('button', { name: 'Collapse Root' })).toHaveAttribute('aria-expanded', 'true');
    // The child rules form a list of their own inside the folder's row, not a role-overridden one.
    const folderRow = screen.getAllByRole('listitem')[0];
    expect(within(folderRow).getByRole('list')).toHaveTextContent('child rule');
  });
});
