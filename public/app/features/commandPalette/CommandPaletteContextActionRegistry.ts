import { ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import { CommandPaletteContextActionConfig } from '@grafana/data';

import { deepFreeze } from '../plugins/extensions/utils';

const logPrefix = '[CommandPaletteContextAction]';

export interface CommandPaletteContextActionRegistryItem {
  pluginId: string;
  config: CommandPaletteContextActionConfig;
}

type PluginContextActionConfigs = {
  pluginId: string;
  configs: CommandPaletteContextActionConfig[];
};

type RegistryType = Record<string, CommandPaletteContextActionRegistryItem[]>;

const MSG_CANNOT_REGISTER_READ_ONLY = 'Cannot register to a read-only registry';

export class CommandPaletteContextActionRegistry {
  private isReadOnly: boolean;
  private resultSubject: Subject<PluginContextActionConfigs>;
  private registrySubject: ReplaySubject<RegistryType>;

  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType>;
      initialState?: RegistryType;
    } = {}
  ) {
    this.resultSubject = new Subject<PluginContextActionConfigs>();
    this.isReadOnly = false;

    if (options.registrySubject) {
      this.registrySubject = options.registrySubject;
      this.isReadOnly = true;
      return;
    }

    this.registrySubject = new ReplaySubject<RegistryType>(1);
    this.resultSubject
      .pipe(
        scan(this.mapToRegistry.bind(this), options.initialState ?? {}),
        startWith(options.initialState ?? {}),
        map((registry) => deepFreeze(registry))
      )
      .subscribe(this.registrySubject);
  }

  private mapToRegistry(registry: RegistryType, item: PluginContextActionConfigs): RegistryType {
    const { pluginId, configs } = item;

    for (let index = 0; index < configs.length; index++) {
      const config = configs[index];

      if (!config.id || typeof config.id !== 'string') {
        console.error(`${logPrefix} Plugin ${pluginId}: context action missing id`);
        continue;
      }

      if (!config.isAvailable || typeof config.isAvailable !== 'function') {
        console.error(`${logPrefix} Plugin ${pluginId}: context action ${config.id} missing isAvailable`);
        continue;
      }

      const actionId = `${pluginId}/${config.id}`;

      if (!(actionId in registry)) {
        registry[actionId] = [];
      }

      registry[actionId].push({ pluginId, config });

      if (process.env.NODE_ENV === 'development') {
        console.log(`${logPrefix} Registered context action: ${actionId}`);
      }
    }

    return registry;
  }

  register(result: PluginContextActionConfigs): void {
    if (this.isReadOnly) {
      throw new Error(MSG_CANNOT_REGISTER_READ_ONLY);
    }

    this.resultSubject.next(result);
  }

  asObservable() {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<RegistryType> {
    return firstValueFrom(this.asObservable());
  }

  async getAvailableActions(pathname: string, search: string): Promise<CommandPaletteContextActionRegistryItem[]> {
    const registry = await this.getState();
    const available: CommandPaletteContextActionRegistryItem[] = [];
    const context = { pathname, search };

    for (const [, registryItems] of Object.entries(registry)) {
      if (!Array.isArray(registryItems) || registryItems.length === 0) {
        continue;
      }

      const item = registryItems[0];
      try {
        if (item.config.isAvailable(context)) {
          available.push(item);
        }
      } catch (error) {
        console.error(`${logPrefix} isAvailable failed for ${item.config.id}`, { error: String(error) });
      }
    }

    return available;
  }

  readOnly() {
    return new CommandPaletteContextActionRegistry({
      registrySubject: this.registrySubject,
    });
  }
}

export const commandPaletteContextActionRegistry = new CommandPaletteContextActionRegistry();
