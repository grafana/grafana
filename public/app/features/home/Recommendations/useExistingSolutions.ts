import { type ExistingItem, type ExistingSolutionProviderResult } from './types';
import { useKubernetesSolution } from './useKubernetesSolution';

export interface ExistingSolutionsResult {
  loading: boolean;
  solutions: ExistingItem[];
}

/**
 * Registry of the solutions the homepage knows how to detect live data for.
 * Each provider hook is called statically and unconditionally (Rules of Hooks);
 * add future solutions as additional calls, in UI order.
 */
export function useExistingSolutions(): ExistingSolutionsResult {
  const kubernetes = useKubernetesSolution();

  const providers: ExistingSolutionProviderResult[] = [kubernetes];

  const solutions = providers.flatMap((provider) => (provider.item ? [provider.item] : []));
  // A discovered solution renders immediately; the empty state waits for every
  // provider to settle so a slow probe never yields a premature no-data card.
  const loading = solutions.length === 0 && providers.some((provider) => provider.loading);

  return { loading, solutions };
}
