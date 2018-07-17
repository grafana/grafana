export function generateQueryKey(index = 0) {
  return `Q-${Date.now()}-${Math.random()}-${index}`;
}

export function ensureQueries(queries?) {
  if (queries && typeof queries === 'object' && queries.length > 0 && typeof queries[0] === 'string') {
    return queries.map((query, i) => ({ key: generateQueryKey(i), query }));
  }
  return [{ key: generateQueryKey(), query: '' }];
}

export function hasQuery(queries) {
  return queries.some(q => q.query);
}
