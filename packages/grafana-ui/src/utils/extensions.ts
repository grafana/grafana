import { ComponentClass } from 'react';

export interface ExtensionProps<T = any> {
  options: T;
  onOptionsChange: (options: T) => void;
}

export interface Extension<TOptions = any> {
  id: string; // Unique Key -- saved in configs
  name: string; // Display Name, can change without breaking configs
  description: string;
  defaultOptions?: TOptions; // what to use when creating a new instance
  aliasIds?: string[]; // when the ID changes, we may want backwards compatibility ('current' => 'last')

  /**
   * Some extensions should not be user selectable
   *  like: 'all' and 'any' matchers;
   */
  excludeFromPicker?: boolean;

  /**
   * Convert the options to a string
   */
  getOptionsDisplayText?: (options: TOptions) => string;

  /**
   * The Options editor
   */
  editor?: ComponentClass<ExtensionProps<TOptions>>;

  /**
   * ??? maybe a readonly alternative to `getOptionsDisplayText`?
   */
  display?: ComponentClass<ExtensionProps<TOptions>>;
}

export class ExtensionRegistry<T extends Extension> {
  private list: T[] = [];
  private byId = new Map<string, T>();

  getIfExists(id: string): T | undefined {
    return this.byId.get(id);
  }

  get(id: string): T {
    const v = this.byId.get(id);
    if (!v) {
      throw new Error('Undefined: ' + v);
    }
    return v;
  }

  register(ext: T) {
    if (this.byId.has(ext.id)) {
      throw new Error('Duplicate Key:' + ext.id);
    }
    this.byId.set(ext.id, ext);
    this.list.push(ext);

    if (ext.aliasIds) {
      for (const alias of ext.aliasIds) {
        if (!this.byId.has(alias)) {
          this.byId.set(alias, ext);
        }
      }
    }
  }
}
