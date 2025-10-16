import { store } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

const QUERY_FINGERPRINT_PREFIX = 'grafana.querySaveAnimation';

// Hash query content to track similar queries (excludes refId, hide, key)
function generateQueryFingerprint(query: DataQuery): string {
  const { refId, hide, key, ...relevantQuery } = query;
  const queryString = JSON.stringify(relevantQuery);

  let hash = 0;
  for (let i = 0; i < queryString.length; i++) {
    const char = queryString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return hash.toString();
}

interface QueryExecutionData {
  count: number;
  lastExecution: number;
}

// Track query executions in localStorage for save animation feature
export function trackQueryExecution(query: DataQuery): void {
  try {
    const fingerprint = generateQueryFingerprint(query);
    const key = `${QUERY_FINGERPRINT_PREFIX}.${fingerprint}`;
    const stored = store.get(key);

    let data: QueryExecutionData = stored
      ? JSON.parse(stored)
      : {
          count: 0,
          lastExecution: 0,
        };

    data = {
      count: data.count + 1,
      lastExecution: Date.now(),
    };

    store.set(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to track query execution for save animation:', error);
  }
}
