import { BehaviorSubject } from 'rxjs';
import { fireEvent } from 'test/test-utils';

import { isAssistantAvailable, toggleAssistant } from '@grafana/assistant';
import { type EmbeddedKeybindingsSnapshot, locationService } from '@grafana/runtime';

import { AppChromeService } from '../components/AppChrome/AppChromeService';

import { KeybindingSrv } from './keybindingSrv';

const route = { path: '/', component: () => null };

function setup(initialAvailability = false) {
  const availability = new BehaviorSubject(initialAvailability);
  jest.mocked(isAssistantAvailable).mockReturnValue(availability);
  const keybindings = new KeybindingSrv(locationService, new AppChromeService());
  const snapshots: EmbeddedKeybindingsSnapshot[] = [];
  const subscription = keybindings.embeddedKeybindings.snapshots.subscribe((snapshot) => snapshots.push(snapshot));
  keybindings.clearAndInitGlobalBindings(route);

  return {
    availability,
    keybindings,
    latest: () => snapshots.at(-1),
    close: () => {
      keybindings.clearAndInitGlobalBindings({ ...route, chromeless: true });
      availability.complete();
      subscription.unsubscribe();
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(toggleAssistant).mockClear();
});

it('opens Dashboards from both the native shortcut and the embedded command', () => {
  const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});
  const { keybindings, latest, close } = setup();
  try {
    expect(latest()).toEqual({
      revision: 1,
      bindings: [{ id: 'go-to-dashboards', keys: 'g d', allowInEditable: false }],
    });

    fireEvent.keyDown(document.body, { key: 'g', which: 71 });
    fireEvent.keyDown(document.body, { key: 'd', which: 68 });
    expect(push).toHaveBeenCalledWith('/dashboards');
    push.mockClear();

    expect(keybindings.embeddedKeybindings.invoke('go-to-dashboards', 1)).toBe(true);
    expect(push).toHaveBeenCalledWith('/dashboards');
    expect(keybindings.embeddedKeybindings.invoke('change-theme', 1)).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  } finally {
    close();
  }
});

it('publishes Assistant availability and rejects invocations from an older snapshot', () => {
  const { availability, keybindings, latest, close } = setup();
  try {
    availability.next(true);
    expect(latest()).toEqual({
      revision: 2,
      bindings: [
        { id: 'go-to-dashboards', keys: 'g d', allowInEditable: false },
        { id: 'open-assistant', keys: 'mod+.', allowInEditable: false },
      ],
    });
    expect(keybindings.embeddedKeybindings.invoke('open-assistant', 2)).toBe(true);
    expect(toggleAssistant).toHaveBeenCalledWith({ origin: 'grafana/keyboard-shortcut', prompt: '', context: [] });

    availability.next(false);
    expect(latest()).toEqual({
      revision: 3,
      bindings: [{ id: 'go-to-dashboards', keys: 'g d', allowInEditable: false }],
    });
    expect(keybindings.embeddedKeybindings.invoke('go-to-dashboards', 2)).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke('open-assistant', 3)).toBe(false);
    expect(toggleAssistant).toHaveBeenCalledTimes(1);
  } finally {
    close();
  }
});

it('invalidates the previous route and keeps chromeless routes empty as availability changes', () => {
  const { availability, keybindings, latest, close } = setup(true);
  try {
    expect(latest()).toEqual({
      revision: 1,
      bindings: [
        { id: 'go-to-dashboards', keys: 'g d', allowInEditable: false },
        { id: 'open-assistant', keys: 'mod+.', allowInEditable: false },
      ],
    });
    keybindings.clearAndInitGlobalBindings({ ...route, path: '/login', chromeless: true });
    availability.next(false);
    availability.next(true);

    expect(latest()).toEqual({ revision: 2, bindings: [] });
    expect(keybindings.embeddedKeybindings.invoke('go-to-dashboards', 1)).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke('open-assistant', 2)).toBe(false);
    expect(toggleAssistant).not.toHaveBeenCalled();
  } finally {
    close();
  }
});
