import { Dictionary, groupBy } from 'lodash';
import { useMemo } from 'react';

import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItem } from './ScopesTreeItem';
import { ScopesTreeLoading } from './ScopesTreeLoading';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { Node, NodeReason, NodesMap, OnNodeSelectToggle, OnNodeUpdate, TreeScope } from './types';

export interface ScopesTreeProps {
  nodes: NodesMap;
  nodePath: string[];
  loadingNodeName: string | undefined;
  scopes: TreeScope[];
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
  const groupedNodes: Dictionary<Node[]> = useMemo(() => groupBy(childNodes, 'reason'), [childNodes]);
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
          nodeReason={NodeReason.Persisted}
          scopes={scopes}
          scopeNames={scopeNames}
          type="persisted"
          onNodeSelectToggle={onNodeSelectToggle}
          onNodeUpdate={onNodeUpdate}
        />

        <ScopesTreeHeadline
          anyChildExpanded={anyChildExpanded}
          query={node.query}
          resultsNodes={groupedNodes[NodeReason.Result] ?? []}
        />

        <ScopesTreeItem
          anyChildExpanded={anyChildExpanded}
          groupedNodes={groupedNodes}
          isLastExpandedNode={isLastExpandedNode}
          loadingNodeName={loadingNodeName}
          node={node}
          nodePath={nodePath}
          nodeReason={NodeReason.Result}
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
