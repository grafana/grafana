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
    latest: () => snapshots[snapshots.length - 1],
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

it('publishes all active shortcuts registered by the service', () => {
  const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});
  const { keybindings, latest, close } = setup();
  try {
    const { revision, bindings } = latest();
    expect(revision).toBe(1);
    expect(bindings.map(({ keys }) => keys).sort()).toEqual([
      '?',
      'c r',
      'c t',
      'esc',
      'g a',
      'g d',
      'g e',
      'g h',
      'g p',
    ]);
    expect(bindings.find(({ keys }) => keys === 'esc')?.allowInEditable).toBe(true);

    fireEvent.keyDown(document.body, { key: 'g', which: 71 });
    fireEvent.keyDown(document.body, { key: 'e', which: 69 });
    expect(push).toHaveBeenCalledWith('/explore');
    push.mockClear();

    const explore = bindings.find(({ keys }) => keys === 'g e')!;
    expect(explore.allowInEditable).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke(explore.id, revision)).toBe(true);
    expect(push).toHaveBeenCalledWith('/explore');
    expect(keybindings.embeddedKeybindings.invoke('unknown', revision)).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  } finally {
    close();
  }
});

it('publishes Assistant availability and rejects invocations from an older snapshot', () => {
  const { availability, keybindings, latest, close } = setup();
  try {
    const initial = latest();
    availability.next(true);
    const enabled = latest();
    const assistant = enabled.bindings.find(({ keys }) => keys === 'mod+.')!;
    expect(enabled.revision).toBe(initial.revision + 1);
    expect(keybindings.embeddedKeybindings.invoke(assistant.id, enabled.revision)).toBe(true);
    expect(toggleAssistant).toHaveBeenCalledWith({ origin: 'grafana/keyboard-shortcut', prompt: '', context: [] });

    availability.next(false);
    const disabled = latest();
    expect(disabled.revision).toBe(enabled.revision + 1);
    expect(disabled.bindings).toEqual(initial.bindings);
    expect(keybindings.embeddedKeybindings.invoke(initial.bindings[0].id, enabled.revision)).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke(assistant.id, disabled.revision)).toBe(false);
    expect(toggleAssistant).toHaveBeenCalledTimes(1);
  } finally {
    close();
  }
});

it('tracks route-specific shortcuts registered and removed after initialization', () => {
  const { keybindings, latest, close } = setup(true);
  const runQueries = jest.fn();
  try {
    keybindings.setupTimeRangeBindings(false);
    keybindings.bind(['e r', 'e q'], runQueries);
    const explore = latest();
    expect(explore.bindings.map(({ keys }) => keys)).toEqual(
      expect.arrayContaining(['e r', 'e q', 't a', 't +', 'ctrl+z'])
    );
    const run = explore.bindings.find(({ keys }) => keys === 'e r')!;

    fireEvent.keyDown(document.body, { key: 'e', which: 69 });
    fireEvent.keyDown(document.body, { key: 'r', which: 82 });
    expect(keybindings.embeddedKeybindings.invoke(run.id, explore.revision)).toBe(true);
    expect(runQueries).toHaveBeenCalledTimes(2);

    keybindings.unbind('e r');
    const updated = latest();
    const alias = updated.bindings.find(({ keys }) => keys === 'e q')!;
    expect(updated.revision).toBe(explore.revision + 1);
    expect(updated.bindings).not.toContainEqual(run);
    expect(keybindings.embeddedKeybindings.invoke(run.id, explore.revision)).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke(run.id, updated.revision)).toBe(false);
    fireEvent.keyDown(document.body, { key: 'e', which: 69 });
    fireEvent.keyDown(document.body, { key: 'r', which: 82 });
    expect(runQueries).toHaveBeenCalledTimes(2);
    expect(keybindings.embeddedKeybindings.invoke(alias.id, updated.revision)).toBe(true);
    expect(runQueries).toHaveBeenCalledTimes(3);

    keybindings.clearAndInitGlobalBindings(route);
    const routeKeys = latest().bindings.map(({ keys }) => keys);
    expect(routeKeys).not.toContain('e q');
    expect(routeKeys).not.toContain('t a');
  } finally {
    close();
  }
});

it('invalidates the previous route and keeps only chromeless bindings as availability changes', () => {
  const { availability, keybindings, latest, close } = setup(true);
  try {
    const previous = latest();
    const assistant = previous.bindings.find(({ keys }) => keys === 'mod+.')!;
    keybindings.clearAndInitGlobalBindings({ ...route, path: '/login', chromeless: true });
    availability.next(false);
    availability.next(true);

    const chromeless = latest();
    expect(chromeless.revision).toBe(previous.revision + 1);
    expect(chromeless.bindings.map(({ keys }) => keys)).toEqual(['c t', 'c r']);
    expect(keybindings.embeddedKeybindings.invoke(assistant.id, previous.revision)).toBe(false);
    expect(keybindings.embeddedKeybindings.invoke(assistant.id, chromeless.revision)).toBe(false);
    expect(toggleAssistant).not.toHaveBeenCalled();
  } finally {
    close();
  }
});
