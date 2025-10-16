import { store } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

const QUERY_FINGERPRINT_PREFIX = 'grafana.querySaveAnimation';

/**
 * Generates a simple hash for query content to track similar queries
 * Excludes fields that don't affect query similarity
 */
function generateQueryFingerprint(query: DataQuery): string {
  // Create a normalized copy excluding fields that don't affect similarity
  const { refId, hide, key, ...relevantQuery } = query;
  const queryString = JSON.stringify(relevantQuery);

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < queryString.length; i++) {
    const char = queryString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString();
}

interface QueryExecutionData {
  count: number;
  lastExecution: number;
}

/**
 * Tracks query execution for the query save animation feature.
 * Stores execution count in localStorage to trigger animation after threshold is met.
 * Call this when queries are executed in Explore, Dashboards, or Annotations
 * to track usage and show the save query feature discovery animation.
 */
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
    // Gracefully handle storage errors (quota exceeded, etc.)
    console.warn('Failed to track query execution for save animation:', error);
  }
}
