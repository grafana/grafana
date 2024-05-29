import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

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
  isLoadingScopes: boolean;
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
  isLoadingScopes,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  const isLoading = isLoadingScopes || !!loadingNodeId;

  const anyChildExpanded = Object.values(nodes).some((node) => node.isExpanded);

  const handleInputChange = debounce((evt: ChangeEvent<HTMLInputElement>) => {
    onNodeUpdate(path, true, evt.target.value);
  }, 500);

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={isLoading}
          placeholder="Filter"
          defaultValue={query}
          onChange={handleInputChange}
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

          const isSelectedIdx = scopeNames.findIndex((scopeName) => scopeName === linkId);
          const isSelected = isSelectedIdx !== -1;
          const isLastSelected = isSelected && isSelectedIdx === scopeNames.length - 1;

          if (anyChildExpanded && !isExpanded && !isSelected) {
            return null;
          }

          const nodePath = [...path, nodeId];

          const handleTitleClick = (evt: MouseEvent<HTMLSpanElement | SVGElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (isExpandable) {
              onNodeUpdate(nodePath, !isExpanded, query);
            } else if (linkId) {
              onNodeSelectToggle(nodePath);
            }
          };

          const handleTitleKeyDown = (evt: KeyboardEvent<HTMLDivElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (linkId && evt.key === 'Space') {
              return onNodeSelectToggle(nodePath);
            }

            if (isExpandable && evt.key === 'Enter') {
              return onNodeUpdate(nodePath, !isExpanded, query);
            }
          };

          const handleCheckboxClick = (evt: MouseEvent<HTMLInputElement>) => {
            evt.stopPropagation();

            if (isLoading) {
              return;
            }

            if (linkId) {
              onNodeSelectToggle(nodePath);
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

                {isExpandable && (
                  <Icon
                    className={styles.itemIcon}
                    name={!isExpanded ? 'folder' : loadingNodeId === nodeId ? 'spinner' : 'folder-open'}
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
                  nodes={nodes}
                  isExpanded={isExpanded}
                  query={query}
                  path={nodePath}
                  loadingNodeId={loadingNodeId}
                  scopeNames={scopeNames}
                  isLoadingScopes={isLoadingScopes}
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
