import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, FilterInput, Icon, RadioButtonDot, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { NodesMap, TreeScope } from './types';

export interface ScopesTreeLevelProps {
  nodes: NodesMap;
  nodePath: string[];
  loadingNodeName: string | undefined;
  scopes: TreeScope[];
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
  onNodeSelectToggle: (path: string[]) => void;
}

export function ScopesTreeLevel({
  nodes,
  nodePath,
  loadingNodeName,
  scopes,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  const nodeId = nodePath[nodePath.length - 1];
  const node = nodes[nodeId];
  const childNodes = node.nodes;
  const childNodesArr = Object.values(childNodes);
  const isNodeLoading = loadingNodeName === nodeId;

  const scopeNames = scopes.map(({ scopeName }) => scopeName);
  const anyChildExpanded = childNodesArr.some(({ isExpanded }) => isExpanded);

  const [queryValue, setQueryValue] = useState(node.query);
  useEffect(() => {
    setQueryValue(node.query);
  }, [node.query]);
  const onQueryUpdate = useMemo(() => debounce(onNodeUpdate, 500), [onNodeUpdate]);

  return (
    <>
      {!anyChildExpanded && (
        <FilterInput
          placeholder={t('scopes.tree.search', 'Search')}
          value={queryValue}
          className={styles.searchInput}
          data-testid={`scopes-tree-${nodeId}-search`}
          onChange={(value) => {
            setQueryValue(value);
            onQueryUpdate(nodePath, true, value);
          }}
        />
      )}

      {Object.keys(node.persistedNodes).length > 0 && (
        <div className={styles.itemChildren}>
          <ScopesTreeLevel
            nodes={node.persistedNodes}
            nodePath={nodePath}
            loadingNodeName={loadingNodeName}
            scopes={scopes}
            onNodeUpdate={onNodeUpdate}
            onNodeSelectToggle={onNodeSelectToggle}
          />
        </div>
      )}

      {!anyChildExpanded ? (
        <h6 className={styles.headline}>
          {!node.query ? (
            <Trans i18nKey="scopes.tree.headline.recommended">Recommended</Trans>
          ) : (
            <Trans i18nKey="scopes.tree.headline.results">Results</Trans>
          )}
        </h6>
      ) : null}

      <div role="tree">
        {isNodeLoading && <Skeleton count={5} className={styles.loader} />}

        {!isNodeLoading &&
          childNodesArr.map((childNode) => {
            const isSelected = childNode.isSelectable && scopeNames.includes(childNode.linkId!);

            if (anyChildExpanded && !childNode.isExpanded && !isSelected) {
              return null;
            }

            const childNodePath = [...nodePath, childNode.name];

            const radioName = childNodePath.join('.');

            return (
              <div key={childNode.name} role="treeitem" aria-selected={childNode.isExpanded}>
                <div className={styles.itemTitle}>
                  {childNode.isSelectable && !childNode.isExpanded ? (
                    node.disableMultiSelect ? (
                      <RadioButtonDot
                        id={radioName}
                        name={radioName}
                        checked={isSelected}
                        label=""
                        data-testid={`scopes-tree-${childNode.name}-radio`}
                        onClick={() => {
                          onNodeSelectToggle(childNodePath);
                        }}
                      />
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        data-testid={`scopes-tree-${childNode.name}-checkbox`}
                        onChange={() => {
                          onNodeSelectToggle(childNodePath);
                        }}
                      />
                    )
                  ) : null}

                  {childNode.isExpandable ? (
                    <button
                      className={styles.itemExpand}
                      data-testid={`scopes-tree-${childNode.name}-expand`}
                      aria-label={
                        childNode.isExpanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')
                      }
                      onClick={() => {
                        onNodeUpdate(childNodePath, !childNode.isExpanded, childNode.query);
                      }}
                    >
                      <Icon name={!childNode.isExpanded ? 'angle-right' : 'angle-down'} />

                      {childNode.title}
                    </button>
                  ) : (
                    <span data-testid={`scopes-tree-${childNode.name}-title`}>{childNode.title}</span>
                  )}
                </div>

                <div className={styles.itemChildren}>
                  {childNode.isExpanded && (
                    <ScopesTreeLevel
                      nodes={node.nodes}
                      nodePath={childNodePath}
                      loadingNodeName={loadingNodeName}
                      scopes={scopes}
                      onNodeUpdate={onNodeUpdate}
                      onNodeSelectToggle={onNodeSelectToggle}
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>
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
    loader: css({
      margin: theme.spacing(0.5, 0),
    }),
    itemTitle: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      padding: theme.spacing(0.5, 0),

      '& > label': css({
        gap: 0,
      }),
    }),
    itemExpand: css({
      alignItems: 'center',
      background: 'none',
      border: 0,
      display: 'flex',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
    }),
    itemChildren: css({
      paddingLeft: theme.spacing(4),
    }),
  };
};
