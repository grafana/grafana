import { css } from '@emotion/css';
import React, { KeyboardEvent, MouseEvent } from 'react';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';

import { Node } from './ScopesFiltersScene';

export interface ScopesTreeLevelProps {
  isExpanded: boolean;
  path: string[];
  nodes: Record<string, Node>;
  expandedNodes: string[];
  scopes: Scope[];
  onNodeExpandToggle: (path: string[]) => void;
  onScopeSelectToggle: (linkId: string, parentNodeId: string) => void;
}

export function ScopesTreeLevel({
  isExpanded,
  path,
  nodes,
  expandedNodes,
  scopes,
  onNodeExpandToggle,
  onScopeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  const anyChildExpanded = Object.values(nodes).some((node) => expandedNodes.includes(node.item.nodeId));

  return (
    <div role="tree">
      {Object.values(nodes).map((node) => {
        const {
          item: { nodeId, linkId },
          isSelectable,
          hasChildren,
          children,
        } = node;

        const isExpanded = expandedNodes.includes(nodeId);

        if (anyChildExpanded && !isExpanded) {
          return null;
        }

        const parentNodeId = path[path.length - 1] ?? '';
        const nodePath = [...path, nodeId];
        const isSelected = isSelectable && !!scopes.find((scope) => scope.metadata.name === linkId);

        const handleTitleClick = (evt: MouseEvent<HTMLSpanElement | SVGElement>) => {
          evt.stopPropagation();

          if (hasChildren) {
            onNodeExpandToggle(nodePath);
          } else if (linkId) {
            onScopeSelectToggle(linkId, parentNodeId);
          }
        };

        const handleTitleKeyDown = (evt: KeyboardEvent<HTMLDivElement>) => {
          evt.stopPropagation();

          switch (evt.key) {
            case 'Space':
              break;

            case 'Enter':
              if (hasChildren) {
                onNodeExpandToggle(nodePath);
              }
              break;

            default:
              return;
          }
        };

        const handleCheckboxClick = (evt: MouseEvent<HTMLInputElement>) => {
          evt.stopPropagation();

          if (linkId) {
            onScopeSelectToggle(linkId, parentNodeId);
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
                isExpanded={isExpanded}
                path={nodePath}
                nodes={children}
                expandedNodes={expandedNodes}
                scopes={scopes}
                onNodeExpandToggle={onNodeExpandToggle}
                onScopeSelectToggle={onScopeSelectToggle}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
