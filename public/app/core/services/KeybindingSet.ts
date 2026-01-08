import { mousetrap } from './mousetrap';

export interface KeyBindingItem {
  /** Key or key pattern like mod+o */
  key: string;
  /** Defaults to keydown */
  type?: string;
  /** The handler callback */
  onTrigger: () => void;
}

/**
 * Small util to make it easier to add and unbind Mousetrap keybindings
 */
export class KeybindingSet {
  private _binds: KeyBindingItem[] = [];

  addBinding(item: KeyBindingItem) {
    mousetrap.bind(
      item.key,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        item.onTrigger();
      },
      item.type ?? 'keydown'
    );
    this._binds.push({
      ...item,
      type: item.type ?? 'keydown',
    });
  }

  removeAll() {
    this._binds.forEach((item) => {
      mousetrap.unbind(item.key, item.type);
    });
    this._binds = [];
  }
}
