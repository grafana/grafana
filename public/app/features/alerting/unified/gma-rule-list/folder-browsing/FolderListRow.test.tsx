import { HttpResponse, http } from 'msw';
import { type ComponentProps } from 'react';
import { render, screen, within } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import { FolderListRow } from './FolderListRow';

const server = setupMswServer();

const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

function mockParents(titles: string[]) {
  server.use(
    http.get(FOLDER_PARENTS_URL, () =>
      HttpResponse.json({ items: titles.map((title, i) => ({ name: `f${i}`, title })) })
    )
  );
}

type RowProps = ComponentProps<typeof FolderListRow>;

function rowUi(overrides: Partial<RowProps> = {}) {
  const props: RowProps = {
    folderUid: 'root',
    title: 'Root',
    kind: 'alert',
    count: { status: 'loaded', count: 2 },
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
  it('shows the own title as a link, the parent path for a nested folder, and the pluralized count', async () => {
    mockParents(['Platform', 'Infra', 'Kubernetes']);
    renderRow({ folderUid: 'k8s', title: 'Kubernetes', count: { status: 'loaded', count: 21 } });

    expect(screen.getByRole('link', { name: 'Kubernetes' })).toHaveAttribute(
      'href',
      '/dashboards/f/k8s/kubernetes/alerting'
    );
    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(screen.getAllByText('Kubernetes')).toHaveLength(1);
    expect(screen.getByText('21 alert rules')).toBeInTheDocument();
  });

  it('shows no path for a top-level folder and singular recording count', async () => {
    mockParents(['Root']);
    renderRow({ kind: 'recording', count: { status: 'loaded', count: 1 } });

    expect(screen.getByText('1 recording rule')).toBeInTheDocument();
    expect(screen.getAllByText('Root')).toHaveLength(1);
  });

  it('shows an unavailable message with a Retry that calls the lookup retry when the count failed', async () => {
    mockParents(['Root']);
    const retry = jest.fn();
    const { user } = renderRow({ count: { status: 'error', retry } });

    expect(screen.getByText('Count unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry loading the rule count of Root' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('toggles through the chevron button only and renders children only while expanded', async () => {
    mockParents(['Root']);
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

  it('explains on hover that the count covers only rules directly in the folder', async () => {
    mockParents(['Root']);
    const { user } = renderRow({ count: { status: 'loaded', count: 2 } });

    await user.hover(screen.getByText('2 alert rules'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Rules directly in this folder. Subfolders are listed separately.'
    );
  });
});
