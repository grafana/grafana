import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesTreeLevel } from './ScopesTreeLevel';
import { Node, NodesMap, TreeScope } from './types';

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
  const styles = useStyles2(getStyles);

  const nodeId = nodePath[nodePath.length - 1];
  const node = nodes[nodeId];
  const childNodesArr = Object.values(node.nodes);

  const { persistedNodes, resultsNodes } = childNodesArr.reduce<Record<string, Node[]>>(
    (acc, node) => {
      switch (node.type) {
        case 'persisted':
          acc.persistedNodes.push(node);
          break;

        case 'result':
          acc.resultsNodes.push(node);
          break;
      }

      return acc;
    },
    {
      persistedNodes: [],
      resultsNodes: [],
    }
  );

  const isNodeLoading = loadingNodeName === nodeId;

  const scopeNames = scopes.map(({ scopeName }) => scopeName);
  const anyChildExpanded = childNodesArr.some(({ isExpanded }) => isExpanded);
  const anyChildSelected = childNodesArr.some(({ linkId }) => linkId && scopeNames.includes(linkId!));

  const onQueryUpdate = useMemo(() => debounce(onNodeUpdate, 500), [onNodeUpdate]);

  return (
    <>
      {!anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          placeholder={t('scopes.tree.search', 'Search')}
          defaultValue={node.query}
          data-testid={`scopes-tree-${nodeId}-search`}
          onInput={(evt) => onQueryUpdate(nodePath, true, evt.currentTarget.value)}
        />
      )}

      <ScopesTreeLevel
        anyChildExpanded={anyChildExpanded}
        anyChildSelected={anyChildSelected}
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

      {!anyChildExpanded ? (
        <h6 className={styles.headline}>
          {!node.query ? (
            <Trans i18nKey="scopes.tree.headline.recommended">Recommended</Trans>
          ) : (
            <Trans i18nKey="scopes.tree.headline.results">Results</Trans>
          )}
        </h6>
      ) : null}

      <ScopesTreeLevel
        anyChildExpanded={anyChildExpanded}
        anyChildSelected={anyChildSelected}
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
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    searchInput: css({
      margin: theme.spacing(1, 0),
    }),
    headline: css({
      color: theme.colors.text.secondary,
      margin: theme.spacing(1, 0),
    }),
  };
};
