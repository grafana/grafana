import { cleanup, render, screen } from 'test/test-utils';

import {
  type CommentsAnchor,
  type CommentsProviderProps,
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

// What the shared comments UI hands the notebook for a cell; each test says what it wants to see.
let anchor: CommentsAnchor | undefined;
const toggle = jest.fn();
const useAnchor = jest.fn((anchorId: string) => (anchorId === 'cell-1' ? anchor : undefined));

function buildCell(id?: string) {
  return new NotebookCellItem({
    elementName: 'md1',
    source: 'user',
    id,
    content: { kind: 'Markdown', spec: { text: 'Hello' } },
  });
}

function anAnchor(overrides: Partial<CommentsAnchor> = {}): CommentsAnchor {
  return { count: 0, isOpen: false, toggle, setElement: jest.fn(), canWrite: true, ...overrides };
}

describe('NotebookCellComments', () => {
  beforeEach(() => {
    anchor = anAnchor();
    registerComments({ Provider, useAnchor });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('puts an add-comment button on the cell, anchored to its id', () => {
    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(useAnchor).toHaveBeenCalledWith('cell-1');
    expect(screen.getByRole('button', { name: 'Add comment' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('counts the comments and opens them on click', async () => {
    anchor = anAnchor({ count: 3 });

    const { user } = render(<NotebookCellComments cell={buildCell('cell-1')} />);
    const button = screen.getByRole('button', { name: 'Show comments (3)' });
    expect(button).toHaveTextContent('3');

    await user.click(button);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('says when the comments are open, and tells the cell', () => {
    anchor = anAnchor({ count: 1, isOpen: true });
    const onActiveChange = jest.fn();

    render(<NotebookCellComments cell={buildCell('cell-1')} onActiveChange={onActiveChange} />);

    expect(screen.getByRole('button', { name: 'Hide comments (1)' })).toHaveAttribute('aria-expanded', 'true');
    expect(onActiveChange).toHaveBeenLastCalledWith(true);
  });

  it('attaches the anchor element callback to the button, which is what the box floats beside', () => {
    const setElement = jest.fn();
    anchor = anAnchor({ setElement });

    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(setElement).toHaveBeenCalledWith(screen.getByRole('button', { name: 'Add comment' }));
  });

  it('shows nothing on a cell without comments to someone who cannot comment', () => {
    anchor = anAnchor({ canWrite: false, count: 0 });

    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still shows the comments of a cell to someone who cannot comment', () => {
    anchor = anAnchor({ canWrite: false, count: 2 });

    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(screen.getByRole('button', { name: 'Show comments (2)' })).toBeInTheDocument();
  });

  it('shows nothing where comments are not available', () => {
    anchor = undefined;

    render(<NotebookCellComments cell={buildCell('cell-1')} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing for a cell that has no id yet', () => {
    render(<NotebookCellComments cell={buildCell()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(useAnchor).not.toHaveBeenCalled();
  });
});

describe('CommentsProvider slot', () => {
  it('renders its children as they are on the PDF render route', () => {
    registerComments({ Provider, useAnchor });

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
    registerComments({ Provider, useAnchor });

    render(
      <CommentsProvider target={{ kind: 'Notebook', name: 'nb1' }}>
        <span>document</span>
      </CommentsProvider>
    );

    expect(screen.getByText('provider for Notebook nb1')).toBeInTheDocument();
    expect(screen.getByText('document')).toBeInTheDocument();
  });
});
