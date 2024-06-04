import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, Input, useStyles2 } from '@grafana/ui';
import { IconButton } from '@grafana/ui/';
import { t } from 'app/core/internationalization';

import { NodesMap } from './types';

export interface ScopesTreeLevelProps {
  showQuery: boolean;
  nodes: NodesMap;
  nodePath: string[];
  loadingNodeId: string | undefined;
  scopeNames: string[];
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
  onNodeSelectToggle: (path: string[]) => void;
}

export function ScopesTreeLevel({
  showQuery,
  nodes,
  nodePath,
  loadingNodeId,
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
  const anyChildSelected = childNodesArr.some(({ item: { linkId } }) => linkId && scopeNames.includes(linkId!));

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={!!loadingNodeId}
          placeholder={t('scopes.tree.search', 'Filter')}
          defaultValue={node.query}
          onChange={debounce((evt) => {
            onNodeUpdate(nodePath, true, evt.target.value);
          }, 500)}
        />
      )}

      <div role="tree">
        {childNodesArr.map((childNode) => {
          const isSelected = childNode.isSelectable && scopeNames.includes(childNode.item.linkId!);

          if (anyChildExpanded && !childNode.isExpanded && !isSelected) {
            return null;
          }

          const childNodePath = [...nodePath, childNode.item.nodeId];

          return (
            <div key={childNode.item.nodeId} role="treeitem" aria-selected={childNode.isExpanded}>
              <div className={styles.itemTitle}>
                {childNode.isSelectable && !childNode.isExpanded ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={!!loadingNodeId}
                    onChange={() => {
                      onNodeSelectToggle(childNodePath);
                    }}
                  />
                ) : null}

                {childNode.isExpandable && (
                  <IconButton
                    aria-label={
                      childNode.isExpanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')
                    }
                    disabled={(anyChildSelected && !childNode.isExpanded) || !!loadingNodeId}
                    name={
                      !childNode.isExpanded
                        ? 'angle-right'
                        : loadingNodeId === childNode.item.nodeId
                          ? 'spinner'
                          : 'angle-down'
                    }
                    onClick={() => {
                      onNodeUpdate(childNodePath, !childNode.isExpanded, childNode.query);
                    }}
                  />
                )}

                <span>{childNode.item.title}</span>
              </div>

              <div className={styles.itemChildren}>
                {childNode.isExpanded && (
                  <ScopesTreeLevel
                    showQuery={showQuery}
                    nodes={node.nodes}
                    nodePath={childNodePath}
                    loadingNodeId={loadingNodeId}
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
