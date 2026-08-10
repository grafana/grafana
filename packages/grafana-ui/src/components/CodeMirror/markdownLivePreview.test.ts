import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme } from '@grafana/data';

import { markdownLivePreview } from './markdownLivePreview';
import { createCodeEditorTheme } from './theme';

const theme = createTheme();

let views: EditorView[] = [];

/**
 * jsdom reports a zero-height editor, which puts the viewport at roughly 100
 * lines. Fixtures must stay well under that or only their top would be
 * decorated, and the failures read as logic bugs.
 */
function createView(
  doc: string,
  selection?: { anchor: number; head?: number },
  { before = [], interpolate }: { before?: Extension[]; interpolate?: (text: string) => string } = {}
): EditorView {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection,
      extensions: [...before, markdown({ base: markdownLanguage }), markdownLivePreview(theme, interpolate)],
    }),
  });
  views.push(view);

  // The parse is lazy and budgeted, so the first tree is often empty. Forcing it
  // and dispatching an empty transaction makes the plugin's rebuild deterministic.
  ensureSyntaxTree(view.state, view.state.doc.length, 5000);
  view.dispatch({});

  return view;
}

/** What the user sees, with hidden markers removed. */
const rendered = (view: EditorView) => view.contentDOM.textContent;

afterEach(() => {
  views.forEach((view) => view.destroy());
  views = [];
});

describe('markdownLivePreview', () => {
  it('leaves the document untouched', () => {
    const doc = '# Title\n\nSome **bold** text.';
    const view = createView(doc, { anchor: doc.length });

    expect(view.state.doc.toString()).toBe(doc);
  });

  it('hides heading markers along with the space they leave behind', () => {
    const view = createView('# Title\n\nbody', { anchor: 11 });

    // Not ' Title' — HeaderMark covers the `#` only, so the separator has to go too.
    expect(rendered(view)).toBe('Titlebody');
  });

  it.each([
    ['bold', '**bold** tail', 'bold tail'],
    ['italic', '*italic* tail', 'italic tail'],
    ['strikethrough', '~~gone~~ tail', 'gone tail'],
    ['inline code', '`code` tail', 'code tail'],
    ['link', '[label](https://example.com) tail', 'label tail'],
  ])('hides %s markers', (_name, doc, expected) => {
    const view = createView(`x\n${doc}`, { anchor: 0 });

    expect(rendered(view)).toBe(`x${expected}`);
  });

  it('reveals the markers on the line the cursor is on', () => {
    const view = createView('# Title\n\nbody', { anchor: 11 });
    expect(rendered(view)).toBe('Titlebody');

    view.dispatch({ selection: { anchor: 3 } });

    expect(rendered(view)).toBe('# Titlebody');
  });

  it('reveals every line a selection touches', () => {
    // head lands at the end of line 2, so lines 1-2 reveal and line 3 stays hidden.
    const view = createView('# One\n## Two\n### Three', { anchor: 0, head: 12 });

    expect(rendered(view)).toBe('# One## TwoThree');
  });

  it('reveals only the cursor line when the selection is very large', () => {
    const doc = Array.from({ length: 80 }, (_, i) => `# Heading ${i}`).join('\n');
    const view = createView(doc, { anchor: 0, head: doc.length });

    // Select-all would otherwise un-render the entire document at once.
    expect(rendered(view)?.startsWith('Heading 0')).toBe(true);
    expect(rendered(view)).toContain(`# Heading ${79}`);
  });

  it('leaves image syntax alone', () => {
    const view = createView('x\n![alt text](https://e.com/a.png)', { anchor: 0 });

    // Nothing renders the image yet, so hiding the markers would collapse it to
    // bare alt text and the image would vanish without trace.
    expect(rendered(view)).toBe('x![alt text](https://e.com/a.png)');
  });

  it('keeps a fenced code block’s fences visible', () => {
    const view = createView('```js\nconst a = 1;\n```', { anchor: 0 });

    expect(rendered(view)).toContain('```');
  });

  it('does not touch non-GFM markers that the renderer would show literally', () => {
    const view = createView('x\nH~2~O and 2^10^', { anchor: 0 });

    expect(rendered(view)).toBe('xH~2~O and 2^10^');
  });

  it('marks up heading lines for screen readers', () => {
    const view = createView('## Title\n\nbody', { anchor: 12 });

    const heading = view.contentDOM.querySelector('[role="heading"]');
    expect(heading).not.toBeNull();
    expect(heading?.getAttribute('aria-level')).toBe('2');
    expect(heading?.classList.contains('cm-md-h2')).toBe(true);
  });

  it('does not rebuild decorations during an IME composition', () => {
    const view = createView('# Title\n\nbody', { anchor: 11 });
    expect(rendered(view)).toBe('Titlebody');

    // Replacing DOM mid-composition aborts it in Chrome and Safari, so moving
    // onto the heading must not reveal its marker until the composition ends.
    Object.defineProperty(view, 'composing', { value: true, configurable: true });
    view.dispatch({ selection: { anchor: 3 } });

    expect(rendered(view)).toBe('Titlebody');
  });

  // The default code theme's syntax highlighting emits bare `.ͼtag` rules and is
  // mounted after ours, so it would win any equal-specificity tie. Our own class
  // names out-specify it instead.
  describe('over the default code editor theme', () => {
    // Same order CodeEditor uses: the Grafana theme first, ours last.
    const createStyledView = (doc: string, selection: { anchor: number }) =>
      createView(doc, selection, { before: [createCodeEditorTheme(theme)] });

    it('sizes and colours headings as prose', () => {
      const view = createStyledView('# Title\n\nbody', { anchor: 11 });
      const heading = view.contentDOM.querySelector('.cm-md-h1')!;

      const styles = getComputedStyle(heading);
      expect(styles.fontSize).toBe(theme.typography.h1.fontSize);
      // Not the highlight style's `colors.primary.text`.
      expect(styles.color).toBe(theme.colors.text.primary);
    });

    it('sets the body font on the content', () => {
      const view = createStyledView('# Title', { anchor: 0 });

      expect(getComputedStyle(view.contentDOM).fontFamily).toBe(theme.typography.fontFamily);
    });
  });

  describe('variables', () => {
    const values: Record<string, string> = {
      $datacenter: 'eu-west-1',
      '${datacenter}': 'eu-west-1',
      '${datacenter:csv}': 'eu-west-1,us-east-1',
      '[[datacenter]]': 'eu-west-1',
    };
    const interpolate = (text: string) => values[text] ?? text;

    const createVariableView = (doc: string, selection: { anchor: number }) =>
      createView(doc, selection, { interpolate });

    it.each(Object.keys(values))('renders the value of %s', (source) => {
      const view = createVariableView(`x\nRegion: ${source}`, { anchor: 0 });

      expect(rendered(view)).toBe(`xRegion: ${values[source]}`);
      expect(view.state.doc.toString()).toBe(`x\nRegion: ${source}`);
    });

    it('reveals the reference on the line being edited', () => {
      const view = createVariableView('x\nRegion: $datacenter', { anchor: 0 });
      expect(rendered(view)).toBe('xRegion: eu-west-1');

      view.dispatch({ selection: { anchor: 5 } });

      expect(rendered(view)).toBe('xRegion: $datacenter');
    });

    it('leaves text that merely looks like a variable alone', () => {
      const view = createVariableView('x\nIt cost $5 and $notAVariable', { anchor: 0 });

      // Interpolating to itself means there is nothing to show.
      expect(rendered(view)).toBe('xIt cost $5 and $notAVariable');
    });

    it('does not replace a variable inside a hidden link URL', () => {
      const view = createVariableView('x\n[home](https://$datacenter.example.com)', { anchor: 0 });

      // The URL is already hidden; two replacements over one range would collide.
      expect(rendered(view)).toBe('xhome');
    });

    it('is inert to the browser so typing cannot land inside it', () => {
      const view = createVariableView('x\nRegion: $datacenter', { anchor: 0 });

      const widget = view.contentDOM.querySelector('.cm-md-variable');
      expect(widget?.getAttribute('contenteditable')).toBe('false');
      expect(widget?.getAttribute('title')).toBe('$datacenter');
    });

    it('leaves references as source when no interpolate is given', () => {
      const view = createView('x\nRegion: $datacenter', { anchor: 0 });

      expect(rendered(view)).toBe('xRegion: $datacenter');
    });
  });

  it('copies the source, not the rendered text', () => {
    const doc = '# Title';
    const view = createView(doc, { anchor: doc.length });

    // What CodeMirror puts on the clipboard is sliced straight from the doc.
    expect(view.state.sliceDoc(0, doc.length)).toBe('# Title');
  });
});
