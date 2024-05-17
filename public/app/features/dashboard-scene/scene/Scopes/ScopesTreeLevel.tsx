import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { Checkbox, Icon, Input, useStyles2 } from '@grafana/ui';

import { ExpandedNode, Node } from './ScopesFiltersBaseSelectorScene';

export interface ScopesTreeLevelProps {
  nodes: Record<string, Node>;
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

          const isExpanded = expandedNodes.some((expandedNode) => expandedNode.nodeId === nodeId);
          const isSelected = isSelectable && !!scopes.find((scope) => scope.metadata.name === linkId);

          if (anyChildExpanded && !isExpanded && !isSelected) {
            return null;
          }

          const nodePath = [...upperNodePath, nodeId];

          const handleTitleClick = (evt: MouseEvent<HTMLSpanElement | SVGElement>) => {
            evt.stopPropagation();

            if (hasChildren) {
              onNodeExpandToggle(nodeId);
            } else if (linkId) {
              onNodeSelectToggle(linkId, nodePath);
            }
          };

          const handleTitleKeyDown = (evt: KeyboardEvent<HTMLDivElement>) => {
            evt.stopPropagation();

            switch (evt.key) {
              case 'Space':
                if (linkId) {
                  onNodeSelectToggle(linkId, nodePath);
                }
                break;

              case 'Enter':
                if (hasChildren) {
                  onNodeExpandToggle(nodeId);
                }
                break;

              default:
                return;
            }
          };

          const handleCheckboxClick = (evt: MouseEvent<HTMLInputElement>) => {
            evt.stopPropagation();

            if (linkId) {
              onNodeSelectToggle(linkId, nodePath);
            }
          };

          return (
            <div key={nodeId} role="treeitem" aria-selected={isExpanded}>
              <div role="button" tabIndex={0} className={styles.itemTitle}>
                {isSelectable && <Checkbox checked={isSelected} onChange={handleCheckboxClick} />}

                {hasChildren && (
                  <Icon
                    className={styles.itemIcon}
                    name={isExpanded ? 'folder-open' : 'folder'}
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
