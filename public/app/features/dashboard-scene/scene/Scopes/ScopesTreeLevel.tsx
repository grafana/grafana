import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { Checkbox, Icon, Input, useStyles2 } from '@grafana/ui';

import { ExpandedNode, NodesMap } from './types';

export interface ScopesTreeLevelProps {
  isLoadingNodes: boolean;
  isLoadingScopes: boolean;
  nodes: NodesMap;
  expandedNodes: ExpandedNode[];
  scopes: Scope[];
  onNodeQuery: (nodeId: string, query: string) => void;
  onNodeExpandToggle: (nodeId: string) => void;
  onNodeSelectToggle: (linkId: string, path: string[]) => void;

  isExpanded?: boolean;
  showQuery?: boolean;
  upperNodePath?: string[];
}

export function ScopesTreeLevel({
  isLoadingNodes,
  isLoadingScopes,
  nodes,
  expandedNodes,
  scopes,
  onNodeQuery,
  onNodeExpandToggle,
  onNodeSelectToggle,

  isExpanded = true,
  showQuery = false,
  upperNodePath = [''],
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  const isLoading = isLoadingScopes || isLoadingNodes;

  const upperNodeId = upperNodePath[upperNodePath.length - 1] ?? '';

  const anyChildExpanded = Object.values(nodes).some((node) =>
    expandedNodes.some((expandedNode) => expandedNode.nodeId === node.item.nodeId)
  );

  const handleInputChange = debounce((evt: ChangeEvent<HTMLInputElement>) => {
    onNodeQuery(upperNodeId, evt.target.value);
  }, 500);

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={isLoading}
          placeholder="Filter"
          defaultValue={expandedNodes.find((expandedNode) => expandedNode.nodeId === upperNodeId)?.query ?? ''}
          onChange={handleInputChange}
        />
      )}

      <div role="tree">
        {Object.values(nodes).map((node) => {
          const {
            item: { nodeId, linkId },
            isSelectable,
            hasChildren,
            children,
          } = node;

          const isExpandedIdx = expandedNodes.findIndex((expandedNode) => expandedNode.nodeId === nodeId);
          const isExpanded = isExpandedIdx !== -1;
          const isLastExpanded = isExpanded && isExpandedIdx === expandedNodes.length - 1;

          const isSelectedIdx = scopes.findIndex((scope) => scope.metadata.name === linkId);
          const isSelected = isSelectedIdx !== -1;
          const isLastSelected = isSelected && isSelectedIdx === scopes.length - 1;

          if (anyChildExpanded && !isExpanded && !isSelected) {
            return null;
          }

          const nodePath = [...upperNodePath, nodeId];

          const handleTitleClick = (evt: MouseEvent<HTMLSpanElement | SVGElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (hasChildren) {
              onNodeExpandToggle(nodeId);
            } else if (linkId) {
              onNodeSelectToggle(linkId, nodePath);
            }
          };

          const handleTitleKeyDown = (evt: KeyboardEvent<HTMLDivElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (linkId && evt.key === 'Space') {
              return onNodeSelectToggle(linkId, nodePath);
            }

            if (hasChildren && evt.key === 'Enter') {
              return onNodeExpandToggle(nodeId);
            }
          };

          const handleCheckboxClick = (evt: MouseEvent<HTMLInputElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (linkId) {
              onNodeSelectToggle(linkId, nodePath);
            }
          };

          return (
            <div key={nodeId} role="treeitem" aria-selected={isExpanded}>
              <div role="button" tabIndex={0} className={styles.itemTitle}>
                {isSelectable ? (
                  isLastSelected && isLoadingScopes ? (
                    <Icon name="spinner" />
                  ) : (
                    <Checkbox checked={isSelected} disabled={isLoading} onChange={handleCheckboxClick} />
                  )
                ) : null}

                {hasChildren && (
                  <Icon
                    className={styles.itemIcon}
                    name={!isExpanded ? 'folder' : isLastExpanded && isLoadingNodes ? 'spinner' : 'folder-open'}
                    onClick={handleTitleClick}
                  />
                )}

                <span
                  role="button"
                  tabIndex={0}
                  className={styles.itemText}
                  onClick={handleTitleClick}
                  onKeyDown={handleTitleKeyDown}
                >
                  {node.item.title}
                </span>
              </div>

              <div className={styles.itemChildren}>
                <ScopesTreeLevel
                  isLoadingNodes={isLoadingNodes}
                  isLoadingScopes={isLoadingScopes}
                  showQuery={showQuery}
                  isExpanded={isExpanded}
                  upperNodePath={nodePath}
                  nodes={children}
                  expandedNodes={expandedNodes}
                  scopes={scopes}
                  onNodeQuery={onNodeQuery}
                  onNodeExpandToggle={onNodeExpandToggle}
                  onNodeSelectToggle={onNodeSelectToggle}
                />
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
      cursor: 'pointer',
      display: 'flex',
      gap: theme.spacing(1),
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      padding: theme.spacing(0.5, 0),
    }),
    itemIcon: css({
      cursor: 'pointer',
    }),
    itemText: css({
      cursor: 'pointer',
    }),
    itemChildren: css({
      paddingLeft: theme.spacing(4),
    }),
  };
};
