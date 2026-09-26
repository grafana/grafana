import { Registry, type RegistryItem } from '../utils/Registry';

/**
 * @alpha
 */
export interface MonacoLanguageRegistryItem extends RegistryItem {
  init: () => Worker;
  editorOptions?: Record<string, unknown>;
}

/**
 * @alpha
 */
export const monacoLanguageRegistry = new Registry<MonacoLanguageRegistryItem>();
