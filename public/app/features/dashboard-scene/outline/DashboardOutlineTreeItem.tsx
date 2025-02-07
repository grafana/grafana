import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isInCloneChain } from '../utils/clone';

import { DashboardOutlineTree } from './DashboardOutlineTree';
import { DashboardOutlineItem } from './types';

interface Props {
  item: DashboardOutlineItem;
}

export function DashboardOutlineTreeItem({ item }: Props) {
  const { key, title } = item.item.useState();
  const [isExpanded, setIsExpanded] = useState(true);
  const styles = useStyles2(getStyles);
  const hasChildren = 'children' in item && item.children.length > 0;
  const isCloned = useMemo(() => isInCloneChain(key!), [key]);

  return (
    <>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        role="presentation"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-owns={hasChildren ? key : undefined}
      >
        {hasChildren ? (
          <IconButton
            name={isExpanded ? 'angle-down' : 'angle-right'}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={
              isExpanded
                ? t('dashboard.outline.tree.item.collapse', 'Collapse item')
                : t('dashboard.outline.tree.item.expand', 'Expand item')
            }
          />
        ) : (
          <Icon name="graph-bar" className={cx(isCloned && styles.cloned)} />
        )}
        <span role="treeitem" className={cx(isCloned && styles.cloned)}>
          {title}
        </span>
      </Stack>
      {hasChildren && isExpanded && <DashboardOutlineTree items={item.children} id={key} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cloned: css({
    color: theme.colors.text.secondary,
  }),
});
