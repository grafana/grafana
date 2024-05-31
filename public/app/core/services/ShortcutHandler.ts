/**
 * A class to listen to combination shortcuts that don't involve a modifier key (such as t + left).
 *
 * keybindingSrv uses Mousetrap to do most shortcuts, but it doesn't support this kind of shortcut.
 *
 * Ideally we would extend this to support all our shortcuts
 */
export class ShortcutHandler {
  bindings = new Map<string[], Function>();
  activeKeys: string[] = [];

  private handleKeyDown = (event: KeyboardEvent) => {
    const element = event.target;
    const isContentEditable = element && 'isContentEditable' in element && element.isContentEditable;

    if (
      event.repeat ||
      !element ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      isContentEditable
    ) {
      return;
    }

    const pressed = event.key.toLowerCase();

    this.activeKeys.push(pressed);

    const matches = Array.from(this.bindings.entries()).filter(([combo]) =>
      combo.every((key, index) => this.activeKeys[index] === key)
    );

    for (const [_, callback] of matches) {
      callback();
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }

    const pressed = event.key.toLowerCase();

    const index = this.activeKeys.indexOf(pressed);
    if (index > -1) {
      this.activeKeys.splice(index, 1);
    }
  };

  private setupEventListeners() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  private resetEventListeners() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  bind(combo: string[], callback: Function) {
    this.bindings.set(combo, callback); // allows dupes, because arrays

    if (this.bindings.size > 0) {
      this.resetEventListeners();
      this.setupEventListeners();
    }
  }

  reset() {
    this.resetEventListeners();
    this.bindings.clear();
  }
}
