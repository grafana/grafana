import { matchesShortcut } from './shortcuts';

function event(key: string, modifiers: Partial<{ meta: boolean; ctrl: boolean; shift: boolean; alt: boolean }> = {}) {
  return {
    key,
    metaKey: modifiers.meta ?? false,
    ctrlKey: modifiers.ctrl ?? false,
    shiftKey: modifiers.shift ?? false,
    altKey: modifiers.alt ?? false,
  };
}

describe('matchesShortcut', () => {
  // jsdom reports an empty platform, so 'mod' resolves to ctrl in tests
  it('matches mod+k with ctrl on non-Apple platforms', () => {
    expect(matchesShortcut(event('k', { ctrl: true }), 'mod+k')).toBe(true);
    expect(matchesShortcut(event('k', { meta: true }), 'mod+k')).toBe(false);
    expect(matchesShortcut(event('k'), 'mod+k')).toBe(false);
  });

  it('requires named modifiers and rejects extra ones', () => {
    expect(matchesShortcut(event('Enter', { shift: true }), 'shift+enter')).toBe(true);
    expect(matchesShortcut(event('Enter', { shift: true, ctrl: true }), 'shift+enter')).toBe(false);
    expect(matchesShortcut(event('k', { ctrl: true }), 'k')).toBe(false);
  });

  it('is case insensitive on the key', () => {
    expect(matchesShortcut(event('K', { ctrl: true }), 'mod+k')).toBe(true);
  });

  it('does not match a shortcut with no key part', () => {
    expect(matchesShortcut(event('Control', { ctrl: true }), 'mod')).toBe(false);
  });
});
