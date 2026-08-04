const MODIFIERS = new Set(['mod', 'ctrl', 'cmd', 'meta', 'shift', 'alt']);

interface KeyboardEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function isAppleDevice(): boolean {
  return /(iPhone|iPad|Mac)/.test(window.navigator.platform || window.navigator.userAgent);
}

/**
 * Matches a keyboard event against a shortcut string like 'mod+k' or 'shift+enter'. 'mod' resolves to meta on
 * Apple devices and ctrl elsewhere. Modifiers not named in the shortcut must not be pressed.
 */
export function matchesShortcut(event: KeyboardEventLike, shortcut: string): boolean {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const key = parts.find((part) => !MODIFIERS.has(part));
  if (!key) {
    return false;
  }

  const modifiers = new Set(parts.filter((part) => MODIFIERS.has(part)));
  const apple = isAppleDevice();
  const wantsMeta = modifiers.has('meta') || modifiers.has('cmd') || (modifiers.has('mod') && apple);
  const wantsCtrl = modifiers.has('ctrl') || (modifiers.has('mod') && !apple);

  return (
    event.key.toLowerCase() === key &&
    event.metaKey === wantsMeta &&
    event.ctrlKey === wantsCtrl &&
    event.shiftKey === modifiers.has('shift') &&
    event.altKey === modifiers.has('alt')
  );
}
