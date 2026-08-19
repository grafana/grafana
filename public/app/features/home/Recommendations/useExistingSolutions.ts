import { type ExistingItem, type ExistingSolutionProviderResult } from './types';
import { useKubernetesSolution } from './useKubernetesSolution';
import { useTelemetrySolutions } from './useTelemetrySolutions';

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
  const { metrics, logs, traces } = useTelemetrySolutions();

  // UI order: kubernetes, metrics, logs, traces.
  const providers: ExistingSolutionProviderResult[] = [kubernetes, metrics, logs, traces];

  const solutions = providers.flatMap((provider) => (provider.item ? [provider.item] : []));
  // Every provider must settle before anything renders: the default selection is solutions[0],
  // and a later-settling provider earlier in UI order would swap it after first paint.
  const loading = providers.some((provider) => provider.loading);

  return { loading, solutions };
}
