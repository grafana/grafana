import { newSearchSelection } from './selection';

describe('Search selection helper', () => {
  it('simple dashboard selection', () => {
    let sel = newSearchSelection();
    expect(sel.isSelected('dash', 'aaa')).toBe(false);

    sel = sel.update(true, 'dash', ['aaa']);
    expect(sel.isSelected('dash', 'aaa')).toBe(true);

    sel = sel.update(false, 'dash', ['aaa']);
    expect(sel.isSelected('dash', 'aaa')).toBe(false);
    expect(sel.items).toMatchInlineSnapshot(`Map {}`);
  });
});
