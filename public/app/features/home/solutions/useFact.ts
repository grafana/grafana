import { useAsync } from 'react-use';

/**
 * Reads a solution fact through its getter. A recreated solution hands over new getters; unlike bare
 * `useAsync`, a pending re-read hides the previous getter's value so a card never shows the old
 * scope's figures beside fresh ones.
 */
export function useFact<T>(read: () => Promise<T | null>): { value: T | null; loading: boolean } {
  const { value, loading } = useAsync(read, [read]);
  return { value: loading ? null : (value ?? null), loading };
}
