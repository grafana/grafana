import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useIsClone } from '../utils/clone';
import { useElementSelectionScene } from '../utils/utils';

import { DashboardOutlineTree } from './DashboardOutlineTree';
import { DashboardOutlineItem, DashboardOutlineItemType } from './types';

interface Props {
  item: DashboardOutlineItem;
}

export function DashboardOutlineTreeItem({ item: { type, item, children } }: Props) {
  const isExpandable = type !== DashboardOutlineItemType.PANEL;

  const { key, title } = item.useState();
  const [isExpanded, setIsExpanded] = useState(isExpandable);
  const styles = useStyles2(getStyles);
  const isCloned = useIsClone(item);
  const { onSelect } = useElementSelectionScene(item);

  return (
    <>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        role="presentation"
        aria-expanded={isExpandable ? isExpanded : undefined}
        aria-owns={isExpandable ? key : undefined}
      >
        {isExpandable ? (
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
        <span
          role="treeitem"
          className={cx(isCloned && styles.cloned, !isCloned && styles.clickable)}
          onPointerDown={(evt) => {
            if (!isCloned) {
              onSelect?.(evt);
            }
          }}
        >
          {title}
        </span>
      </Stack>
      {isExpandable && isExpanded && <DashboardOutlineTree items={children} id={key} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  clickable: css({
    cursor: 'pointer',
  }),
  cloned: css({
    color: theme.colors.text.secondary,
  }),
});
