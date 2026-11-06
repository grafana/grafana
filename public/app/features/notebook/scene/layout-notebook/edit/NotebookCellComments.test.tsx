import { cleanup, render, screen } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  type NotebookCellCommentsProps,
  registerNotebookCellComments,
} from '../../../enterprise-components/NotebookCellCommentsExtension';
import { NotebookScene } from '../../NotebookScene';
import { NotebookCellItem } from '../NotebookCellItem';
import { NotebookLayoutManager } from '../NotebookLayoutManager';

import { NotebookCellComments } from './NotebookCellComments';

const COMMENTS_FLAG = 'dashboard.notebookComments';

function Comments({ notebookUid, cellId }: NotebookCellCommentsProps) {
  return <div>{`comments for ${notebookUid} / ${cellId}`}</div>;
}

function buildCell({ id, uid }: { id?: string; uid?: string }) {
  const cell = new NotebookCellItem({
    elementName: 'md1',
    source: 'user',
    id,
    content: { kind: 'Markdown', spec: { text: 'Hello' } },
  });
  new NotebookScene({
    title: 'Test notebook',
    uid,
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  return cell;
}

describe('NotebookCellComments', () => {
  beforeEach(() => {
    setTestFlags({ [COMMENTS_FLAG]: true });
    registerNotebookCellComments(Comments);
  });

  afterEach(() => {
    // Unmount first: clearing the flags re-renders anything still mounted outside act().
    cleanup();
    setTestFlags({});
  });

  it('renders the registered component with the notebook uid and the cell id', async () => {
    render(<NotebookCellComments cell={buildCell({ id: 'cell-1', uid: 'nb1' })} />);

    expect(await screen.findByText('comments for nb1 / cell-1')).toBeInTheDocument();
  });

  it('renders nothing with the flag off', () => {
    setTestFlags({ [COMMENTS_FLAG]: false });

    render(<NotebookCellComments cell={buildCell({ id: 'cell-1', uid: 'nb1' })} />);

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });

  it('renders nothing for a cell that has no id yet', () => {
    render(<NotebookCellComments cell={buildCell({ uid: 'nb1' })} />);

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });

  it('renders nothing for a notebook that has not been saved', () => {
    render(<NotebookCellComments cell={buildCell({ id: 'cell-1' })} />);

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });

  it('renders nothing on the PDF render route', () => {
    render(<NotebookCellComments cell={buildCell({ id: 'cell-1', uid: 'nb1' })} />, {
      historyOptions: { initialEntries: ['/notebooks/nb1/render'] },
    });

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });

  it('renders nothing for a cell outside a notebook', () => {
    const cell = new NotebookCellItem({ elementName: 'md1', source: 'user', id: 'cell-1' });

    render(<NotebookCellComments cell={cell} />);

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });
});
