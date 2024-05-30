import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, Input, useStyles2 } from '@grafana/ui';
import { IconButton } from '@grafana/ui/';

import { Node } from './types';

export interface ScopesTreeLevelProps {
  showQuery: boolean;
  nodes: Node[];
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
  query,
  path,
  loadingNodeId,
  scopeNames,
  onNodeUpdate,
  onNodeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  const anyChildExpanded = nodes.some(({ isExpanded }) => isExpanded);
  const anyChildSelected = nodes.some(({ item: { linkId } }) => linkId && scopeNames.includes(linkId!));

  return (
    <>
      {showQuery && !anyChildExpanded && (
        <Input
          prefix={<Icon name="filter" />}
          className={styles.searchInput}
          disabled={!!loadingNodeId}
          placeholder="Filter"
          defaultValue={query}
          onChange={debounce((evt) => {
            onNodeUpdate(path, true, evt.target.value);
          }, 500)}
        />
      )}

      <div role="tree">
        {nodes.map(({ item: { nodeId, linkId, title }, isExpandable, isSelectable, nodes, isExpanded, query }) => {
          const isSelected = isSelectable && scopeNames.includes(linkId!);

          if (anyChildExpanded && !isExpanded && !isSelected) {
            return null;
          }

          const nodePath = [...path, nodeId];

          return (
            <div key={nodeId} role="treeitem" aria-selected={isExpanded}>
              <div className={styles.itemTitle}>
                {isSelectable && !isExpanded ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={!!loadingNodeId}
                    onChange={() => {
                      onNodeSelectToggle(nodePath);
                    }}
                  />
                ) : null}

                {isExpandable && (
                  <IconButton
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    disabled={anyChildSelected || !!loadingNodeId}
                    name={!isExpanded ? 'angle-right' : loadingNodeId === nodeId ? 'spinner' : 'angle-down'}
                    onClick={() => {
                      onNodeUpdate(nodePath, !isExpanded, query);
                    }}
                  />
                )}

                <span>{title}</span>
              </div>

              <div className={styles.itemChildren}>
                {isExpanded && (
                  <ScopesTreeLevel
                    showQuery={showQuery}
                    nodes={Object.values(nodes)}
                    query={query}
                    path={nodePath}
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
