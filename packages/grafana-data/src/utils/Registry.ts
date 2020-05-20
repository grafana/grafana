import { SelectableValue } from '../types/select';

export interface RegistryItem {
  id: string; // Unique Key -- saved in configs
  name: string; // Display Name, can change without breaking configs
  description?: string;
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
      this.initialize();
    }

    if (id) {
      return this.byId.get(id);
    }

    return undefined;
  }

  private initialize() {
    if (this.init) {
      for (const ext of this.init()) {
        this.register(ext);
      }
    }
    this.sort();
    this.initialized = true;
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
      this.initialize();
    }

    const select = {
      options: [],
      current: [],
    } as RegistrySelectInfo;

    const currentOptions: Record<string, SelectableValue<string>> = {};
    if (current) {
      for (const id of current) {
        currentOptions[id] = {};
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
      if (currentOptions[ext.id]) {
        currentOptions[ext.id] = option;
      }
    }

    if (current) {
      // this makes sure we preserve the order of ids
      select.current = Object.values(currentOptions);
    }

    return select;
  }

  /**
   * Return a list of values by ID, or all values if not specified
   */
  list(ids?: any[]): T[] {
    if (!this.initialized) {
      this.initialize();
    }

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

    return this.ordered;
  }

  isEmpty(): boolean {
    if (!this.initialized) {
      this.initialize();
    }

    return this.ordered.length === 0;
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
