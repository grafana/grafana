import { getIconForKind } from './icons';

describe('getIconForKind', () => {
  it.each([
    { desc: 'a dashboard', kind: 'dashboard', isOpen: false, icon: 'apps' },
    { desc: 'a closed folder', kind: 'folder', isOpen: false, icon: 'folder' },
    { desc: 'an open folder', kind: 'folder', isOpen: true, icon: 'folder-open' },
    { desc: 'the shared with me section', kind: 'sharedwithme', isOpen: false, icon: 'users-alt' },
    { desc: 'a kind it does not know, such as a panel', kind: 'panel', isOpen: false, icon: 'question-circle' },
  ])('returns $icon for $desc', ({ kind, isOpen, icon }) => {
    expect(getIconForKind(kind, isOpen)).toBe(icon);
  });
});
