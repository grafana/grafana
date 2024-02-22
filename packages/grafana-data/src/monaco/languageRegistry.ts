import { Registry, RegistryItem } from '../utils/Registry';

/**
 * @alpha
 */
export interface MonacoLanguageRegistryItem extends RegistryItem {
  init: () => Worker;
}

/**
 * @alpha
 */
export const monacoLanguageRegistry = new Registry<MonacoLanguageRegistryItem>();
