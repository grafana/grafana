import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, IconButton, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { NodesMap } from './types';

export interface ScopesTreeLevelProps {
  showQuery: boolean;
  nodes: NodesMap;
  nodePath: string[];
  loadingNodeName: string | undefined;
  scopeNames: string[];
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
  onNodeSelectToggle: (path: string[]) => void;
}

export function ScopesTreeLevel({
  showQuery,
  nodes,
  nodePath,
  loadingNodeName,
  scopeNames,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  const nodeId = nodePath[nodePath.length - 1];
  const node = nodes[nodeId];
  const childNodes = node.nodes;
  const childNodesArr = Object.values(childNodes);

  const anyChildExpanded = childNodesArr.some(({ isExpanded }) => isExpanded);
  const anyChildSelected = childNodesArr.some(({ linkId }) => linkId && scopeNames.includes(linkId!));

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={!!loadingNodeName}
          placeholder={t('scopes.tree.search', 'Filter')}
          defaultValue={node.query}
          data-testid={`scopes-tree-${nodeId}-search`}
          onChange={debounce((evt) => {
            onNodeUpdate(nodePath, true, evt.target.value);
          }, 500)}
        />
      )}

      <div role="tree">
        {childNodesArr.map((childNode) => {
          const isSelected = childNode.isSelectable && scopeNames.includes(childNode.linkId!);

          if (anyChildExpanded && !childNode.isExpanded && !isSelected) {
            return null;
          }

          const childNodePath = [...nodePath, childNode.name];

          return (
            <div key={childNode.name} role="treeitem" aria-selected={childNode.isExpanded}>
              <div className={styles.itemTitle}>
                {childNode.isSelectable && !childNode.isExpanded ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={!!loadingNodeName || (anyChildSelected && !isSelected && node.disableMultiSelect)}
                    data-testid={`scopes-tree-${childNode.name}-checkbox`}
                    onChange={() => {
                      onNodeSelectToggle(childNodePath);
                    }}
                  />
                ) : null}

                {childNode.isExpandable && (
                  <IconButton
                    disabled={(anyChildSelected && !childNode.isExpanded) || !!loadingNodeName}
                    name={
                      !childNode.isExpanded
                        ? 'angle-right'
                        : loadingNodeName === childNode.name
                          ? 'spinner'
                          : 'angle-down'
                    }
                    aria-label={
                      childNode.isExpanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')
                    }
                    data-testid={`scopes-tree-${childNode.name}-expand`}
                    onClick={() => {
                      onNodeUpdate(childNodePath, !childNode.isExpanded, childNode.query);
                    }}
                  />
                )}

                <span data-testid={`scopes-tree-${childNode.name}-title`}>{childNode.title}</span>
              </div>

              <div className={styles.itemChildren}>
                {childNode.isExpanded && (
                  <ScopesTreeLevel
                    showQuery={showQuery}
                    nodes={node.nodes}
                    nodePath={childNodePath}
                    loadingNodeName={loadingNodeName}
                    scopeNames={scopeNames}
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
    itemTitle: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      padding: theme.spacing(0.5, 0),
    }),
    itemChildren: css({
      paddingLeft: theme.spacing(4),
    }),
  };
};
