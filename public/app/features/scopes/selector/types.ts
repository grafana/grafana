import { array, boolean as vBoolean, object, optional, picklist, string as vString } from 'valibot';

import { Scope, ScopeNode } from '@grafana/data';

export type NodesMap = Record<string, ScopeNode>;
export type ScopesMap = Record<string, Scope>;

export interface SelectedScope {
  scopeId: string;
  scopeNodeId?: string;
  // Used for recent scopes functionality when scope node isn't loaded yet
  parentNodeId?: string;
}

export interface TreeNode {
  scopeNodeId: string;
  expanded: boolean;
  query: string;
  children?: Record<string, TreeNode>;
  // Check if we have loaded all the children. Used when resolving to root.
  childrenLoaded?: boolean;
}

export interface RecentScope extends Scope {
  parentNode?: ScopeNode;
  scopeNodeId?: string;
}

// Valibot schemas for type validation
export const ScopeSpecFilterSchema = object({
  key: vString(),
  value: vString(),
  values: optional(array(vString())),
  operator: picklist(['equals', 'not-equals', 'regex-match', 'regex-not-match', 'one-of', 'not-one-of']),
});

export const ScopeSpecSchema = object({
  title: vString(),
  defaultPath: optional(array(vString())),
  filters: optional(array(ScopeSpecFilterSchema)),
});

const scopeEntries = {
  metadata: object({
    name: vString(),
  }),
  spec: ScopeSpecSchema,
};

export const ScopeSchema = object(scopeEntries);

export const ScopeNodeSpecSchema = object({
  nodeType: picklist(['container', 'leaf']),
  title: vString(),
  subTitle: optional(vString()),
  description: optional(vString()),
  disableMultiSelect: optional(vBoolean()),
  linkId: optional(vString()),
  linkType: optional(picklist(['scope'])),
  parentName: optional(vString()),
});

export const ScopeNodeSchema = object({
  metadata: object({
    name: vString(),
  }),
  spec: ScopeNodeSpecSchema,
});

export const RecentScopeSchema = object({
  ...scopeEntries,
  parentNode: optional(ScopeNodeSchema),
  scopeNodeId: optional(vString()),
});
