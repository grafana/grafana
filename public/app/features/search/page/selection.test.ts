import { newSearchSelection, updateSearchSelection } from './selection';

describe('Search selection helper', () => {
  it('simple dashboard selection', () => {
    let sel = newSearchSelection();
    expect(sel.isSelected('dash', 'aaa')).toBe(false);

    sel = updateSearchSelection(sel, true, 'dash', ['aaa']);
    expect(sel.isSelected('dash', 'aaa')).toBe(true);
    expect(sel.isSelected('dash', '*')).toBeTruthy();
    expect(sel.isSelected('alert', '*')).toBeFalsy();
    expect(sel.isSelected('*', '*')).toBeTruthy();

    sel = updateSearchSelection(sel, false, 'dash', ['aaa']);
    expect(sel.isSelected('dash', 'aaa')).toBe(false);
    expect(sel.items).toMatchInlineSnapshot(`Map {}`);
    expect(sel.isSelected('*', '*')).toBeFalsy();
  });
});
