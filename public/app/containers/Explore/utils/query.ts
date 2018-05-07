export function buildQueryOptions({ format, interval, instant, now, queries }) {
  const to = now;
  const from = to - 1000 * 60 * 60 * 3;
  return {
    interval,
    range: {
      from,
      to,
    },
    targets: queries.map(expr => ({
      expr,
      format,
      instant,
    })),
  };
}

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
