import { FocusScope } from '@react-aria/focus';
import { KBarPortal, KBarProvider, KBarSearch } from 'kbar';
import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';

import { CommandPaletteKeybinding } from './CommandPaletteKeybinding';

const usesMeta = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const paletteChord = { key: 'k', code: 'KeyK', which: 75, metaKey: usesMeta, ctrlKey: !usesMeta };

function setup(chromeless = false) {
  const keybindings = new KeybindingSrv(locationService, new AppChromeService());
  keybindings.clearAndInitGlobalBindings({ path: '/', component: () => null, chromeless });

  render(
    <KBarProvider options={{ toggleShortcut: false }}>
      <CommandPaletteKeybinding keybindings={keybindings} />
      <input aria-label="Editor input" />
      <input aria-label="Input with its own shortcut" onKeyDown={(event) => event.preventDefault()} />
      <KBarPortal>
        <FocusScope contain autoFocus restoreFocus>
          <KBarSearch defaultPlaceholder="Search Grafana" />
        </FocusScope>
      </KBarPortal>
    </KBarProvider>
  );
}

it('opens the palette from an editable control and closes it on the next press', async () => {
  setup();

  const editor = screen.getByRole('textbox', { name: 'Editor input' });
  editor.focus();
  expect(fireEvent.keyDown(editor, paletteChord)).toBe(false);

  const search = await screen.findByPlaceholderText('Search Grafana');
  expect(search).toHaveFocus();
  expect(fireEvent.keyDown(search, paletteChord)).toBe(false);

  await waitFor(() => expect(screen.queryByPlaceholderText('Search Grafana')).toBeNull());
  await waitFor(() => expect(editor).toHaveFocus());
});

it('leaves the palette closed when an editable control handles the shortcut', () => {
  setup();

  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Input with its own shortcut' }), paletteChord);

  expect(screen.queryByPlaceholderText('Search Grafana')).toBeNull();
});

it('leaves the shortcut unclaimed when Grafana does not register it', () => {
  setup(true);

  expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editor input' }), paletteChord)).toBe(true);
  expect(screen.queryByPlaceholderText('Search Grafana')).toBeNull();
});
