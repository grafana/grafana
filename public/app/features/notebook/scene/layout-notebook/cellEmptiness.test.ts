import { isDiscardableContent, isEmptyMarkdown } from './cellEmptiness';

describe('isEmptyMarkdown', () => {
  it('holds only for markdown with literally no text', () => {
    expect(isEmptyMarkdown({ kind: 'Markdown', spec: { text: '' } })).toBe(true);
    expect(isEmptyMarkdown({ kind: 'Markdown', spec: { text: 'Hello' } })).toBe(false);
  });

  // The trailing-slot invariant and the save model both read this. A heading seeded with its marker is
  // a slot somebody started typing into, and contentCells has to keep it or saving drops the heading —
  // which is exactly where it parts ways with isDiscardableContent.
  it('does not treat a seeded heading marker as untouched', () => {
    expect(isEmptyMarkdown({ kind: 'Markdown', spec: { text: '# ' } })).toBe(false);
  });

  // A panel or collapsed cell carries no `content` at all, and is not a typeable markdown slot either,
  // so one ending up last must still get a fresh empty cell appended after it.
  it('does not count a cell that carries no content', () => {
    expect(isEmptyMarkdown(undefined)).toBe(false);
  });

  it('does not count an empty code cell, which still carries a language choice', () => {
    expect(isEmptyMarkdown({ kind: 'Code', spec: { language: 'sql', code: '' } })).toBe(false);
  });
});

describe('isDiscardableContent', () => {
  describe('markdown', () => {
    it.each([
      ['nothing at all', ''],
      ['whitespace only', '   \n  '],
      ['a seeded heading marker', '# '],
      ['a deeper heading marker', '### '],
      ['an abandoned bullet marker', '- '],
      ['an abandoned ordered marker', '2. '],
      ['an abandoned quote marker', '> '],
    ])('discards a block holding %s', (_label, text) => {
      expect(isDiscardableContent({ kind: 'Markdown', spec: { text } })).toBe(true);
    });

    it.each([
      ['prose', 'Hello notebook'],
      ['a filled-in heading', '# Incident timeline'],
      ['a filled-in list item', '- first step'],
      // Four leading spaces make an indented code block: the renderer shows this cell as a code block
      // containing "-", so the marker here is content, not an unfilled marker.
      ['an indented code block that looks like a marker', '    -'],
      // Likewise real text that happens to start with marker characters.
      ['text opening with a hash', '#hashtag'],
      ['a number the markers must not swallow', '123'],
    ])('keeps the confirmation for a block holding %s', (_label, text) => {
      expect(isDiscardableContent({ kind: 'Markdown', spec: { text } })).toBe(false);
    });
  });

  describe('code', () => {
    it('discards a code block with no code, whatever language was picked', () => {
      expect(isDiscardableContent({ kind: 'Code', spec: { language: 'sql', code: '   ' } })).toBe(true);
    });

    it('keeps the confirmation once there is code', () => {
      expect(isDiscardableContent({ kind: 'Code', spec: { language: 'sql', code: 'select 1' } })).toBe(false);
    });

    // Nothing authors an annotation yet, but an assistant- or API-written cell can arrive carrying one,
    // and CodeCell preserves it across edits — so it is content, even with no code beside it.
    it('keeps the confirmation for an annotated code block with no code', () => {
      expect(isDiscardableContent({ kind: 'Code', spec: { language: 'sql', code: '', annotation: 'why' } })).toBe(
        false
      );
    });
  });

  // A panel cell carries no content, and neither does a collapsed cell holding a panel. Panel
  // emptiness is not read off the queries at all: every viz type but the notebook's own keeps content
  // outside them, so deleting a visualization always asks.
  it('keeps the confirmation for a cell that carries no content', () => {
    expect(isDiscardableContent(undefined)).toBe(false);
  });
});
