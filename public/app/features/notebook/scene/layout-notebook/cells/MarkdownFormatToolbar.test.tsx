import { EditorView } from '@codemirror/view';
import { createRef } from 'react';
import { act, fireEvent, render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import { MarkdownCellEditor } from './MarkdownCellEditor';
import { MARKDOWN_FORMAT_TOOLBAR_TEST_ID, MarkdownFormatToolbar } from './MarkdownFormatToolbar';

// Uses real MarkdownCellEditor/CodeMirror instances (as MarkdownChecklist.test.tsx does). jsdom has no layout, so
// positioning is not asserted, only whether the toolbar is shown.
describe('MarkdownFormatToolbar', () => {
  it('renders nothing when its container has no mounted editor to find', () => {
    const editorContainerRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div>
        <div ref={editorContainerRef} />
        <MarkdownFormatToolbar editorContainerRef={editorContainerRef} />
      </div>
    );

    expect(screen.queryByTestId(MARKDOWN_FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('renders nothing before the container ref has anything attached', () => {
    const editorContainerRef = createRef<HTMLDivElement>();

    render(<MarkdownFormatToolbar editorContainerRef={editorContainerRef} />);

    expect(screen.queryByTestId(MARKDOWN_FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
  });

  describe('with real editors', () => {
    // jsdom has neither DOMRect nor layout; floating-ui measures the selection's virtual reference with it.
    const originalDOMRect = globalThis.DOMRect;
    beforeAll(() => {
      globalThis.DOMRect = class {
        constructor(
          public x = 0,
          public y = 0,
          public width = 0,
          public height = 0
        ) {}
        get top() {
          return this.y;
        }
        get left() {
          return this.x;
        }
        get right() {
          return this.x + this.width;
        }
        get bottom() {
          return this.y + this.height;
        }
      } as unknown as typeof DOMRect;
    });
    afterAll(() => {
      globalThis.DOMRect = originalDOMRect;
    });

    // jsdom reports no document focus once focus falls back to <body>; a browser still has window focus there.
    beforeEach(() => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    async function setup() {
      const onChangeA = jest.fn();
      const onChangeB = jest.fn();
      const { user } = render(
        <div>
          <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text: 'alpha beta' } }} onChange={onChangeA} />
          <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text: 'gamma delta' } }} onChange={onChangeB} />
          <button>Outside</button>
        </div>
      );
      const editors = await screen.findAllByRole('textbox', { name: 'Markdown' });
      const [a, b] = editors.map((editor) => EditorView.findFromDOM(editor)!);
      return { user, a, b, onChangeA };
    }

    // Mirrors the browser's event order for a mouse selection: focus moves on pointerdown, the selection
    // changes, selectionchange fires on the document, then mouseup.
    function select(view: EditorView, anchor: number, head: number) {
      fireEvent.pointerDown(view.contentDOM);
      act(() => {
        view.focus();
        view.dispatch({ selection: { anchor, head } });
      });
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      fireEvent.mouseUp(view.contentDOM);
    }

    it('shows the toolbar for a selection in the focused editor', async () => {
      const { a } = await setup();
      select(a, 0, 5);
      expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    });

    it('shows only the active cell toolbar when selecting in another cell', async () => {
      const { a, b } = await setup();
      select(a, 0, 5);
      select(b, 0, 5);
      expect(screen.getAllByRole('toolbar')).toHaveLength(1);
      expect(a.state.selection.main).toMatchObject({ empty: true, head: 5 });
      expect(b.state.selection.main).toMatchObject({ from: 0, to: 5 });
    });

    it('hides the toolbar and clears the selection when clicking outside the cell', async () => {
      const { user, a } = await setup();
      select(a, 0, 5);
      await user.click(screen.getByRole('button', { name: 'Outside' }));
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
      expect(a.state.selection.main).toMatchObject({ empty: true, head: 5 });
    });

    it('keeps the selection when the browser window loses focus', async () => {
      const { a } = await setup();
      select(a, 0, 5);
      jest.spyOn(document, 'hasFocus').mockReturnValue(false);
      act(() => {
        a.contentDOM.blur();
      });
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
      expect(a.state.selection.main).toMatchObject({ from: 0, to: 5 });
    });

    it('keeps the toolbar when reselecting within the same cell', async () => {
      const { a } = await setup();
      select(a, 0, 5);
      select(a, 6, 10);
      expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    });

    it('applies a format action from the toolbar', async () => {
      const { user, a, onChangeA } = await setup();
      select(a, 0, 5);
      await user.click(screen.getByLabelText(selectors.components.PageToolbar.item('Italic')));
      expect(onChangeA).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '*alpha* beta' } });
    });

    it('hides the toolbar when tabbing out of the cell', async () => {
      const { user, a } = await setup();
      select(a, 0, 5);
      expect(screen.getAllByRole('toolbar')).toHaveLength(1);
      await user.tab();
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
      expect(a.state.selection.main).toMatchObject({ empty: true, head: 5 });
    });

    it('hides the toolbar and clears the selection when focus tabs off the toolbar', async () => {
      const { user, a } = await setup();
      select(a, 0, 5);
      const toolbar = screen.getByRole('toolbar');
      const buttons = within(toolbar).getAllByRole('button');
      act(() => {
        buttons[buttons.length - 1].focus();
      });
      expect(screen.getAllByRole('toolbar')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
      expect(a.state.selection.main).toMatchObject({ empty: true, head: 5 });
    });
  });
});
