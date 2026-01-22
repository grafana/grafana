import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { ScopesTreeItem } from './ScopesTreeItem';
import { TreeNode } from './types';

type Props = {
  anyChildExpanded: boolean;
  lastExpandedNode: boolean;
  items: TreeNode[];
  maxHeight: string;
  highlightedId: string | undefined;
  id: string;
};

export function ScopesTreeItemList({ items, anyChildExpanded, lastExpandedNode, maxHeight, highlightedId, id }: Props) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  const children = (
    <div role="tree" id={id} className={anyChildExpanded ? styles.expandedContainer : undefined}>
      {items.map((childNode) => (
        <ScopesTreeItem
          key={childNode.scopeNodeId}
          treeNode={childNode}
          anyChildExpanded={anyChildExpanded}
          highlighted={childNode.scopeNodeId === highlightedId}
        />
      ))}
    </div>
  );

  if (lastExpandedNode) {
    return (
      <ScrollContainer minHeight={`${Math.min(5, items.length) * 30}px`} maxHeight={maxHeight}>
        {children}
      </ScrollContainer>
    );
  }

  return children;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    expandedContainer: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
    }),
  };
};
