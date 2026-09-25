/**
 * Tracks the most recent input modality used inside the command palette.
 *
 * kbar's `onSelectAction` callback does not pass the originating event, so we
 * cannot tell from there whether the user activated an action via keyboard or
 * mouse. Instead, the dialog wrapper records the input mode on every key/pointer
 * event, and the action_selected reporter reads the most recent value.
 *
 * Module-scoped because the producer (CommandPalette) and consumer
 * (AppWrapper's onSelectAction callback) sit in unrelated parts of the React tree.
 */

let lastMode: 'keyboard' | 'mouse' | 'unknown' = 'unknown';

export function setCommandPaletteInputMode(mode: 'keyboard' | 'mouse'): void {
  lastMode = mode;
}

export function getCommandPaletteInputMode(): 'keyboard' | 'mouse' | 'unknown' {
  return lastMode;
}

/** Reset between palette sessions so a stale value can't leak across opens. */
export function resetCommandPaletteInputMode(): void {
  lastMode = 'unknown';
}
