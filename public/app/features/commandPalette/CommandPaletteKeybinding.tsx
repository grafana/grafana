import { useKBar } from 'kbar';
import { useEffect } from 'react';

import { type KeybindingSrv } from 'app/core/services/keybindingSrv';

export function CommandPaletteKeybinding({ keybindings }: { keybindings: KeybindingSrv }) {
  const { query, disabled } = useKBar((state) => ({ disabled: state.disabled }));

  useEffect(() => {
    if (!disabled) {
      return keybindings.registerCommandPaletteToggle(query.toggle);
    }
    return undefined;
  }, [disabled, keybindings, query]);

  return null;
}
