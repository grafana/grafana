import { Dictionary, groupBy } from 'lodash';
import { useMemo } from 'react';

import { InternalScopeNode, InternalScopeNodeReason, InternalScopeNodesMap, InternalTreeScope } from '@grafana/data';

import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItem } from './ScopesTreeItem';
import { ScopesTreeLoading } from './ScopesTreeLoading';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { OnNodeSelectToggle, OnNodeUpdate } from './types';

export interface ScopesTreeProps {
  nodes: InternalScopeNodesMap;
  nodePath: string[];
  loadingNodeName: string | undefined;
  scopes: InternalTreeScope[];
  onNodeUpdate: OnNodeUpdate;
  onNodeSelectToggle: OnNodeSelectToggle;
}

export function ScopesTree({
  nodes,
  nodePath,
  loadingNodeName,
  scopes,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeProps) {
  const nodeId = nodePath[nodePath.length - 1];
  const node = nodes[nodeId];
  const childNodes = Object.values(node.nodes);
  const isNodeLoading = loadingNodeName === nodeId;
  const scopeNames = scopes.map(({ scopeName }) => scopeName);
  const anyChildExpanded = childNodes.some(({ isExpanded }) => isExpanded);
  const groupedNodes: Dictionary<InternalScopeNode[]> = useMemo(() => groupBy(childNodes, 'reason'), [childNodes]);
  const isLastExpandedNode = !anyChildExpanded && node.isExpanded;

  return (
    <>
      <ScopesTreeSearch
        anyChildExpanded={anyChildExpanded}
        nodePath={nodePath}
        query={node.query}
        onNodeUpdate={onNodeUpdate}
      />

      <ScopesTreeLoading isNodeLoading={isNodeLoading}>
        <ScopesTreeItem
          anyChildExpanded={anyChildExpanded}
          groupedNodes={groupedNodes}
          isLastExpandedNode={isLastExpandedNode}
          loadingNodeName={loadingNodeName}
          node={node}
          nodePath={nodePath}
          nodeReason={InternalScopeNodeReason.Persisted}
          scopes={scopes}
          scopeNames={scopeNames}
          type="persisted"
          onNodeSelectToggle={onNodeSelectToggle}
          onNodeUpdate={onNodeUpdate}
        />

        <ScopesTreeHeadline
          anyChildExpanded={anyChildExpanded}
          query={node.query}
          resultsNodes={groupedNodes[InternalScopeNodeReason.Result] ?? []}
        />

        <ScopesTreeItem
          anyChildExpanded={anyChildExpanded}
          groupedNodes={groupedNodes}
          isLastExpandedNode={isLastExpandedNode}
          loadingNodeName={loadingNodeName}
          node={node}
          nodePath={nodePath}
          nodeReason={InternalScopeNodeReason.Result}
          scopes={scopes}
          scopeNames={scopeNames}
          type="result"
          onNodeSelectToggle={onNodeSelectToggle}
          onNodeUpdate={onNodeUpdate}
        />
      </ScopesTreeLoading>
    </>
  );
}
