import { Registry, RegistryItem } from '../utils/Registry';

export interface MonacoLanguageRegistryItem extends RegistryItem {
  init: () => Promise<void>;
}

export const monacoLanguageRegistry = new Registry<MonacoLanguageRegistryItem>();
