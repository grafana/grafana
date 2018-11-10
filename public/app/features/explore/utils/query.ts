import { Query } from 'app/types/explore';

export function generateQueryKey(index = 0): string {
  return `Q-${Date.now()}-${Math.random()}-${index}`;
}

export function ensureQueries(queries?: Query[]): Query[] {
  if (queries && typeof queries === 'object' && queries.length > 0 && typeof queries[0].query === 'string') {
    return queries.map(({ query }, i) => ({ key: generateQueryKey(i), query }));
  }
  return [{ key: generateQueryKey(), query: '' }];
}

export function hasQuery(queries: string[]): boolean {
  return queries.some(q => Boolean(q));
}
