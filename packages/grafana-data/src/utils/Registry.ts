import { SelectableValue } from '../types/select';

export interface RegistryItem {
  id: string; // Unique Key -- saved in configs
  name: string; // Display Name, can change without breaking configs
  description: string;
  aliasIds?: string[]; // when the ID changes, we may want backwards compatibility ('current' => 'last')

  /**
   * Some extensions should not be user selectable
   *  like: 'all' and 'any' matchers;
   */
  excludeFromPicker?: boolean;
}

export interface RegistryItemWithOptions<TOptions = any> extends RegistryItem {
  /**
   * Convert the options to a string
   */
  getOptionsDisplayText?: (options: TOptions) => string;

  /**
   * Default options used if nothing else is specified
   */
  defaultOptions?: TOptions;
}

interface RegistrySelectInfo {
  options: Array<SelectableValue<string>>;
  current: Array<SelectableValue<string>>;
}

export class Registry<T extends RegistryItem> {
  private ordered: T[] = [];
  private byId = new Map<string, T>();
  private initialized = false;

  constructor(private init?: () => T[]) {}

  setInit = (init: () => T[]) => {
    if (this.initialized) {
      throw new Error('Registry already initialized');
    }
    this.init = init;
  };

  getIfExists(id: string | undefined): T | undefined {
    if (!this.initialized) {
      if (this.init) {
        for (const ext of this.init()) {
          this.register(ext);
        }
      }
      this.sort();
      this.initialized = true;
    }
    if (id) {
      return this.byId.get(id);
    }
    return undefined;
  }

  get(id: string): T {
    const v = this.getIfExists(id);
    if (!v) {
      throw new Error('Undefined: ' + id);
    }
    return v;
  }

  selectOptions(current?: string[], filter?: (ext: T) => boolean): RegistrySelectInfo {
    if (!this.initialized) {
      this.getIfExists('xxx'); // will trigger init
    }

    const select = {
      options: [],
      current: [],
    } as RegistrySelectInfo;

    const currentIds: any = {};
    if (current) {
      for (const id of current) {
        currentIds[id] = true;
      }
    }

    for (const ext of this.ordered) {
      if (ext.excludeFromPicker) {
        continue;
      }
      if (filter && !filter(ext)) {
        continue;
      }

      const option = {
        value: ext.id,
        label: ext.name,
        description: ext.description,
      };

      select.options.push(option);
      if (currentIds[ext.id]) {
        select.current.push(option);
      }
    }
    return select;
  }

  /**
   * Return a list of values by ID, or all values if not specified
   */
  list(ids?: any[]): T[] {
    if (ids) {
      const found: T[] = [];
      for (const id of ids) {
        const v = this.getIfExists(id);
        if (v) {
          found.push(v);
        }
      }
      return found;
    }
    if (!this.initialized) {
      this.getIfExists('xxx'); // will trigger init
    }
    return [...this.ordered]; // copy of everythign just in case
  }

  register(ext: T) {
    if (this.byId.has(ext.id)) {
      throw new Error('Duplicate Key:' + ext.id);
    }
    this.byId.set(ext.id, ext);
    this.ordered.push(ext);

    if (ext.aliasIds) {
      for (const alias of ext.aliasIds) {
        if (!this.byId.has(alias)) {
          this.byId.set(alias, ext);
        }
      }
    }

    if (this.initialized) {
      this.sort();
    }
  }

  private sort() {
    // TODO sort the list
  }
}
