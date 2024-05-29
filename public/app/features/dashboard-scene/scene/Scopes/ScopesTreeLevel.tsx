import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, Input, useStyles2 } from '@grafana/ui';

import { NodesMap } from './types';

export interface ScopesTreeLevelProps {
  showQuery: boolean;
  nodes: NodesMap;
  isExpanded: boolean;
  query: string;
  path: string[];
  loadingNodeId: string | undefined;
  scopeNames: string[];
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
  onNodeSelectToggle: (path: string[]) => void;
}

export function ScopesTreeLevel({
  showQuery,
  nodes,
  isExpanded = true,
  query,
  path,
  loadingNodeId,
  scopeNames,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  const isLoading = !!loadingNodeId;

  const anyChildExpanded = Object.values(nodes).some((node) => node.isExpanded);

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={isLoading}
          placeholder="Filter"
          defaultValue={query}
          onChange={debounce((evt) => {
            onNodeUpdate(path, true, evt.target.value);
          }, 500)}
        />
      )}

      <div role="tree">
        {Object.values(nodes).map((node) => {
          const {
            item: { nodeId, linkId },
            isExpandable,
            isSelectable,
            nodes,
            isExpanded,
            query,
          } = node;

          const isSelected = isSelectable && scopeNames.includes(linkId!);

          if (anyChildExpanded && !isExpanded && !isSelected) {
            return null;
          }

          const nodePath = [...path, nodeId];

          return (
            <div key={nodeId} role="treeitem" aria-selected={isExpanded}>
              <div role="button" tabIndex={0} className={styles.itemTitle}>
                {isSelectable ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={isLoading}
                    onChange={(evt) => {
                      evt.stopPropagation();

                      if (isLoading) {
                        return;
                      }

                      if (linkId) {
                        onNodeSelectToggle(nodePath);
                      }
                    }}
                  />
                ) : null}

                {isExpandable && (
                  <Icon
                    className={styles.itemIcon}
                    name={!isExpanded ? 'folder' : loadingNodeId === nodeId ? 'spinner' : 'folder-open'}
                    onClick={(evt) => {
                      evt.stopPropagation();

                      if (isLoading) {
                        return;
                      }

                      if (isExpandable) {
                        onNodeUpdate(nodePath, !isExpanded, query);
                      } else if (linkId) {
                        onNodeSelectToggle(nodePath);
                      }
                    }}
                  />
                )}

                <span
                  role="button"
                  tabIndex={0}
                  className={styles.itemText}
                  onClick={(evt) => {
                    evt.stopPropagation();

                    if (isLoading) {
                      return;
                    }

                    if (isExpandable) {
                      onNodeUpdate(nodePath, !isExpanded, query);
                    } else if (linkId) {
                      onNodeSelectToggle(nodePath);
                    }
                  }}
                  onKeyDown={(evt) => {
                    evt.stopPropagation();

                    if (isLoading) {
                      return;
                    }

                    if (linkId && evt.key === 'Space') {
                      onNodeSelectToggle(nodePath);
                    } else if (isExpandable && evt.key === 'Enter') {
                      onNodeUpdate(nodePath, !isExpanded, query);
                    }
                  }}
                >
                  {node.item.title}
                </span>
              </div>

              <div className={styles.itemChildren}>
                <ScopesTreeLevel
                  showQuery={showQuery}
                  nodes={nodes}
                  isExpanded={isExpanded}
                  query={query}
                  path={nodePath}
                  loadingNodeId={loadingNodeId}
                  scopeNames={scopeNames}
                  onNodeUpdate={onNodeUpdate}
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
