import { BehaviorSubject, type Subscription } from 'rxjs';

import { toggleAssistant, isAssistantAvailable } from '@grafana/assistant';
import {
  type EmbeddedKeybinding,
  type EmbeddedKeybindingService,
  type EmbeddedKeybindingsSnapshot,
  type LocationService,
} from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { toggleMockApiAndReload, togglePseudoLocale } from 'app/dev-utils';

import {
  ShiftTimeEvent,
  ShiftTimeEventDirection,
  ShowModalReactEvent,
  ZoomOutEvent,
  AbsoluteTimeEvent,
  CopyTimeEvent,
  PasteTimeEvent,
} from '../../types/events';
import { type AppChromeService } from '../components/AppChrome/AppChromeService';
import { type RouteDescriptor } from '../navigation/types';

import { mousetrap } from './mousetrap';
import { toggleTheme } from './theme';

const assistantKeybinding: EmbeddedKeybinding = { id: 'open-assistant', keys: 'mod+.', allowInEditable: false };

export class KeybindingSrv {
  constructor(
    private locationService: LocationService,
    private chromeService: AppChromeService
  ) {}

  private assistantSubscription?: Subscription;
  private readonly embeddedBindings = new Map<string, { binding: EmbeddedKeybinding; run: () => void }>();
  private readonly embeddedSnapshots = new BehaviorSubject<EmbeddedKeybindingsSnapshot>({ revision: 0, bindings: [] });

  readonly embeddedKeybindings: EmbeddedKeybindingService = {
    snapshots: this.embeddedSnapshots.asObservable(),
    invoke: (id, revision) => {
      const entry = this.embeddedBindings.get(id);
      if (!entry || revision !== this.embeddedSnapshots.value.revision) {
        return false;
      }
      entry.run.call(this);
      return true;
    },
  };

  clearAndInitGlobalBindings(route: RouteDescriptor) {
    this.assistantSubscription?.unsubscribe();
    this.assistantSubscription = undefined;
    mousetrap.reset();
    this.embeddedBindings.clear();

    // Chromeless pages like login and signup page don't get any global bindings
    if (!route.chromeless) {
      this.bind('?', this.showHelpModal);

      this.bind('g h', this.goToHome);
      this.bindEmbedded({ id: 'go-to-dashboards', keys: 'g d', allowInEditable: false }, this.goToDashboards);
      this.bind('g e', this.goToExplore);
      this.bind('g a', this.openAlerting);
      this.bind('g p', this.goToProfile);
      this.bindAssistantShortcutIfAvailable();
      this.bind('esc', this.exit);
      this.bindGlobalEsc();
    }

    this.bind('c t', () => toggleTheme(false));
    this.bind('c r', () => toggleTheme(true));

    if (process.env.NODE_ENV === 'development') {
      // 'change mock'
      this.bind('c m', () => toggleMockApiAndReload());
      // 'change pseudo locale'
      this.bind('c p l', () => togglePseudoLocale());
    }
    this.publishEmbeddedKeybindings();
  }

  bindGlobalEsc() {
    this.bindGlobal('esc', this.globalEsc);
  }

  globalEsc() {
    const anyDoc = document;
    const activeElement = anyDoc.activeElement;

    // typehead needs to handle it
    const typeaheads = document.querySelectorAll('.slate-typeahead--open');
    if (typeaheads.length > 0) {
      return;
    }

    // second check if we are in an input we can blur
    if (activeElement && activeElement instanceof HTMLElement) {
      if (
        activeElement.nodeName === 'INPUT' ||
        activeElement.nodeName === 'TEXTAREA' ||
        activeElement.hasAttribute('data-slate-editor')
      ) {
        activeElement.blur();
        return;
      }
    }

    // ok no focused input or editor that should block this, let exist!
    this.exit();
  }

  private openAlerting() {
    this.locationService.push('/alerting');
  }

  private goToDashboards() {
    this.locationService.push('/dashboards');
  }

  private goToHome() {
    this.locationService.push('/');
  }

  private goToProfile() {
    this.locationService.push('/profile');
  }

  private goToExplore() {
    this.locationService.push('/explore');
  }

  private async showHelpModal() {
    const { HelpModal } = await import(/* webpackChunkName: "help-modal" */ '../components/help/HelpModal');
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  }

  private bindAssistantShortcutIfAvailable() {
    // Include an initial synchronous emission in the route's snapshot.
    let initializing = true;
    this.assistantSubscription = isAssistantAvailable().subscribe((available) => {
      if (available === this.embeddedBindings.has(assistantKeybinding.id)) {
        return;
      }
      if (available) {
        this.bindEmbedded(assistantKeybinding, this.toggleAssistant);
      } else {
        this.unbind(assistantKeybinding.keys, 'keydown');
        this.embeddedBindings.delete(assistantKeybinding.id);
      }
      if (!initializing) {
        this.publishEmbeddedKeybindings();
      }
    });
    initializing = false;
  }

  private bindEmbedded(binding: EmbeddedKeybinding, run: () => void) {
    if (binding.allowInEditable) {
      this.bindGlobal(binding.keys, run);
    } else {
      this.bind(binding.keys, run);
    }
    this.embeddedBindings.set(binding.id, { binding, run });
  }

  private publishEmbeddedKeybindings() {
    this.embeddedSnapshots.next({
      revision: this.embeddedSnapshots.value.revision + 1,
      bindings: Array.from(this.embeddedBindings.values(), ({ binding }) => binding),
    });
  }

  private toggleAssistant() {
    toggleAssistant({
      origin: 'grafana/keyboard-shortcut',
      prompt: '',
      context: [],
    });
  }

  private exit() {
    const search = this.locationService.getSearchObject();

    if (search.editview) {
      this.locationService.partial({ editview: null, editIndex: null });
      return;
    }

    if (search.inspect) {
      this.locationService.partial({ inspect: null, inspectTab: null });
      return;
    }

    if (search.editPanel) {
      this.locationService.partial({ editPanel: null, tab: null });
      return;
    }

    if (search.viewPanel) {
      this.locationService.partial({ viewPanel: null, tab: null });
      return;
    }

    const { kioskMode } = this.chromeService.state.getValue();
    if (kioskMode) {
      this.chromeService.exitKioskMode();
    }
  }

  bind(keyArg: string | string[], fn: () => void) {
    mousetrap.bind(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  bindGlobal(keyArg: string, fn: () => void) {
    mousetrap.bindGlobal(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  unbind(keyArg: string, keyType?: string) {
    mousetrap.unbind(keyArg, keyType);
  }

  setupTimeRangeBindings(updateUrl = true) {
    this.bind('t a', () => {
      appEvents.publish(new AbsoluteTimeEvent({ updateUrl }));
    });

    this.bind('t +', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 0.5, updateUrl }));
    });

    this.bind('t =', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 0.5, updateUrl }));
    });

    this.bind('t -', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('ctrl+z', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('t left', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left, updateUrl }));
    });

    this.bind('t right', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right, updateUrl }));
    });

    this.bind('t c', () => {
      appEvents.publish(new CopyTimeEvent());
    });

    this.bind('t v', () => {
      appEvents.publish(new PasteTimeEvent({ updateUrl }));
    });
  }
}
