import { cleanup, render, screen } from 'test/test-utils';

import {
  type CommentsProviderProps,
  type CommentsTriggerProps,
  CommentsProvider,
  registerComments,
} from '../../../../comments/CommentsExtension';
import { NotebookCellItem } from '../NotebookCellItem';

import { NotebookCellComments } from './NotebookCellComments';

function Provider({ target, children }: CommentsProviderProps) {
  return (
    <div>
      {`provider for ${target.kind} ${target.name}`}
      {children}
    </div>
  );
}

function Trigger({ anchorId }: CommentsTriggerProps) {
  return <div>{`comments for ${anchorId}`}</div>;
}

function buildCell(id?: string) {
  return new NotebookCellItem({
    elementName: 'md1',
    source: 'user',
    id,
    content: { kind: 'Markdown', spec: { text: 'Hello' } },
  });
}

describe('NotebookCellComments', () => {
  beforeEach(() => {
    registerComments({ Provider, Trigger });
  });

  afterEach(() => {
    cleanup();
  });

  it('places the shared comment button on the cell, anchored to its id', async () => {
    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(await screen.findByText('comments for cell-1')).toBeInTheDocument();
  });

  it('renders nothing for a cell that has no id yet', () => {
    render(<NotebookCellComments cell={buildCell()} />);

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });

  it('renders nothing on the PDF render route', () => {
    render(<NotebookCellComments cell={buildCell('cell-1')} />, {
      historyOptions: { initialEntries: ['/notebooks/nb1/render'] },
    });

    expect(screen.queryByText(/comments for/)).not.toBeInTheDocument();
  });
});

describe('CommentsProvider slot', () => {
  it('renders its children as they are on the PDF render route', () => {
    registerComments({ Provider, Trigger });

    render(
      <CommentsProvider target={{ kind: 'Notebook', name: 'nb1' }}>
        <span>document</span>
      </CommentsProvider>,
      { historyOptions: { initialEntries: ['/notebooks/nb1/render'] } }
    );

    expect(screen.getByText('document')).toBeInTheDocument();
    expect(screen.queryByText(/provider for/)).not.toBeInTheDocument();
  });

  it('hands the target to the registered provider', () => {
    registerComments({ Provider, Trigger });

    render(
      <CommentsProvider target={{ kind: 'Notebook', name: 'nb1' }}>
        <span>document</span>
      </CommentsProvider>
    );

    expect(screen.getByText('provider for Notebook nb1')).toBeInTheDocument();
    expect(screen.getByText('document')).toBeInTheDocument();
  });
});
