import { BusEventBase } from '@grafana/data';

/** Publish this event to open keyboard shortcuts modal */
export class OpenKeyboardShortcutsModalEvent extends BusEventBase {
  static type = 'open-keyboard-shortcuts-modal';
}
