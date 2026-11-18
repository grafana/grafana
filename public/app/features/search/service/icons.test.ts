import { getIconForKind } from './icons';

describe('getIconForKind', () => {
  it.each([
    { desc: 'an open folder', kind: 'folder', isOpen: true, icon: 'folder-open' },
    { desc: 'a kind it does not know, such as a panel', kind: 'panel', isOpen: false, icon: 'question-circle' },
  ])('returns $icon for $desc', ({ kind, isOpen, icon }) => {
    expect(getIconForKind(kind, isOpen)).toBe(icon);
  });
});
