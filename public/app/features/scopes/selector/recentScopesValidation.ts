import { z } from 'zod';

import { type StoredRecentScopeSet } from './recentScopesStorage';

const StoredRecentScopeSetSchema = z.object({
  scopeIds: z.array(z.string()).min(1),
  scopeNodeId: z.string().optional(),
  version: z.string(),
});

export function validateStoredRecentScopes(data: StoredRecentScopeSet[]): StoredRecentScopeSet[] {
  return data.filter((entry) => StoredRecentScopeSetSchema.safeParse(entry).success);
}
