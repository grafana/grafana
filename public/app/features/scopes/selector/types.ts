import { z } from 'zod';

import { Scope, ScopeNode } from '@grafana/data';

export type NodesMap = Record<string, ScopeNode>;
export type ScopesMap = Record<string, Scope>;

export interface SelectedScope {
  scopeId: string;
  scopeNodeId?: string;
  // Used to display title next to selected scope
  parentNodeId?: string;
}

export interface TreeNode {
  scopeNodeId: string;
  expanded: boolean;
  query: string;
  children?: Record<string, TreeNode>;
}

export interface RecentScope extends Scope {
  parentNode?: ScopeNode;
}

// Zod schemas for type validation
export const ScopeSpecFilterSchema = z.object({
  key: z.string(),
  value: z.string(),
  values: z.array(z.string()).optional(),
  operator: z.enum(['equals', 'not-equals', 'regex-match', 'regex-not-match', 'one-of', 'not-one-of']),
});

export const ScopeSpecSchema = z.object({
  title: z.string(),
  type: z.string(),
  description: z.string(),
  category: z.string(),
  filters: z.array(ScopeSpecFilterSchema),
});

export const ScopeSchema = z.object({
  metadata: z.object({
    name: z.string(),
  }),
  spec: ScopeSpecSchema,
});

export const ScopeNodeSpecSchema = z.object({
  nodeType: z.enum(['container', 'leaf']),
  title: z.string(),
  description: z.string().optional(),
  disableMultiSelect: z.boolean().optional(),
  linkId: z.string().optional(),
  linkType: z.enum(['scope']).optional(),
  parentName: z.string().optional(),
});

export const ScopeNodeSchema = z.object({
  metadata: z.object({
    name: z.string(),
  }),
  spec: ScopeNodeSpecSchema,
});

export const RecentScopeSchema = ScopeSchema.extend({
  parentNode: ScopeNodeSchema.optional(),
});
