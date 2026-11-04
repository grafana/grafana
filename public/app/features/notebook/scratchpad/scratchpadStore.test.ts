import {
  addNote,
  addPanel,
  clearScratchpad,
  getScratchpad,
  isHeading,
  moveBlock,
  moveItem,
  reloadScratchpadFromStorage,
  removeBlock,
  setTitle,
  toggleHeading,
  toggleHeadingText,
  updateText,
} from './scratchpadStore';

const panel = { kind: 'Panel', spec: { title: 'CPU' } };

describe('scratchpadStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearScratchpad();
  });

  it('adds trimmed notes and ignores empty ones', () => {
    addNote('  hello  ');
    addNote('   ');

    expect(getScratchpad().blocks).toEqual([expect.objectContaining({ kind: 'markdown', text: 'hello' })]);
  });

  it('toggles a text block between paragraph and heading', () => {
    addNote('Findings');
    const [{ id }] = getScratchpad().blocks;

    toggleHeading(id);
    expect(getScratchpad().blocks[0]).toMatchObject({ text: '# Findings' });

    toggleHeading(id);
    expect(getScratchpad().blocks[0]).toMatchObject({ text: 'Findings' });
  });

  it('toggles the prefix without touching the rest of the text', () => {
    expect(toggleHeadingText('a # b')).toBe('# a # b');
    expect(isHeading('# a')).toBe(true);
    expect(isHeading('#a')).toBe(false);
  });

  it('updates text only on text blocks', () => {
    addNote('one');
    addPanel(Object.assign({}, panel) as never);
    const [text, panelBlock] = getScratchpad().blocks;

    updateText(text.id, 'two');
    updateText(panelBlock.id, 'nope');

    expect(getScratchpad().blocks[0]).toMatchObject({ text: 'two' });
    expect(getScratchpad().blocks[1]).toEqual(panelBlock);
  });

  it('moves and removes blocks', () => {
    addNote('a');
    addNote('b');
    addNote('c');

    moveBlock(0, 2);
    expect(getScratchpad().blocks.map((b) => (b.kind === 'markdown' ? b.text : ''))).toEqual(['b', 'c', 'a']);

    removeBlock(getScratchpad().blocks[1].id);
    expect(getScratchpad().blocks.map((b) => (b.kind === 'markdown' ? b.text : ''))).toEqual(['b', 'a']);
  });

  it('moveItem leaves the list alone for a no-op or out-of-range move', () => {
    const items = [1, 2, 3];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, 5, 0)).toBe(items);
  });

  it('survives a reload', () => {
    setTitle('Latency');
    addNote('persisted');

    reloadScratchpadFromStorage();

    expect(getScratchpad()).toMatchObject({ title: 'Latency', blocks: [{ text: 'persisted' }] });
  });

  it('starts empty when storage is corrupt', () => {
    window.localStorage.setItem('grafana.notebooks.scratchpad', '{not json');

    reloadScratchpadFromStorage();

    expect(getScratchpad()).toEqual({ title: '', blocks: [] });
  });
});
