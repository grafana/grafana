import { useMemo } from 'react';

import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItem } from './ScopesTreeItem';
import { ScopesTreeLoading } from './ScopesTreeLoading';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { Node, NodeReason, NodesMap, TreeScope } from './types';

export interface ScopesTreeProps {
  nodes: NodesMap;
  nodePath: string[];
  loadingNodeName: string | undefined;
  scopes: TreeScope[];
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
  onNodeSelectToggle: (path: string[]) => void;
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

  const { persistedNodes, resultsNodes } = useMemo(
    () =>
      childNodes.reduce<Record<string, Node[]>>(
        (acc, node) => {
          switch (node.reason) {
            case NodeReason.Persisted:
              acc.persistedNodes.push(node);
              break;

            case NodeReason.Result:
              acc.resultsNodes.push(node);
              break;
          }

          return acc;
        },
        {
          persistedNodes: [],
          resultsNodes: [],
        }
      ),
    [childNodes]
  );

  return (
    <>
      <ScopesTreeSearch
        anyChildExpanded={anyChildExpanded}
        nodeId={nodeId}
        nodePath={nodePath}
        query={node.query}
        onNodeUpdate={onNodeUpdate}
      />

      <ScopesTreeLoading isNodeLoading={isNodeLoading}>
        <ScopesTreeItem
          anyChildExpanded={anyChildExpanded}
          isNodeLoading={isNodeLoading}
          loadingNodeName={loadingNodeName}
          node={node}
          nodePath={nodePath}
          nodes={persistedNodes}
          scopes={scopes}
          scopeNames={scopeNames}
          onNodeSelectToggle={onNodeSelectToggle}
          onNodeUpdate={onNodeUpdate}
        />

        <ScopesTreeHeadline anyChildExpanded={anyChildExpanded} query={node.query} resultsNodes={resultsNodes} />

        <ScopesTreeItem
          anyChildExpanded={anyChildExpanded}
          isNodeLoading={isNodeLoading}
          loadingNodeName={loadingNodeName}
          node={node}
          nodePath={nodePath}
          nodes={resultsNodes}
          scopes={scopes}
          scopeNames={scopeNames}
          onNodeSelectToggle={onNodeSelectToggle}
          onNodeUpdate={onNodeUpdate}
        />
      </ScopesTreeLoading>
    </>
  );
}
