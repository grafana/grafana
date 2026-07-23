// Prototype-only. Not internationalized.
// Renders the ContentOutline items as a flat, borderless list — reads from
// ContentOutlineContext so it stays in sync with whatever sections Explore
// currently exposes (Queries / Graph / Raw Prometheus / etc.). Skips the
// PanelContainer wrapper that ContentOutline uses so we don't get a nested
// bordered card inside the rail.
/* eslint-disable @typescript-eslint/consistent-type-assertions -- prototype-only cast */

import { css, cx } from '@emotion/css';

import { type IconName, isIconName, type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { useContentOutlineContext } from '../ContentOutline/ContentOutlineContext';

interface Props {
  scroller: HTMLElement | undefined;
  compact?: boolean; // icon-only when the rail is collapsed
  omitPanelIds?: string[]; // root items to exclude (e.g. 'Queries' — shown as cards elsewhere)
}

export function EmbeddedOutline({ scroller, compact, omitPanelIds }: Props) {
  const styles = useStyles2(getStyles);
  const ctx = useContentOutlineContext();
  const items = ctx?.outlineItems ?? [];

  const jumpTo = (ref: HTMLElement | null) => {
    if (!ref || !scroller) {
      return;
    }
    // Native intra-scroller scroll — matches ContentOutline's behavior for
    // clicking a top-level item.
    const scrollerTop = scroller.getBoundingClientRect().top;
    const refTop = ref.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + refTop - scrollerTop - 8, behavior: 'smooth' });
  };

  return (
    <ul className={cx(styles.list, compact && styles.listCompact)}>
      {items
        .filter((item) => item.level === 'root')
        .filter((item) => !omitPanelIds?.includes(item.panelId))
        .map((item) => {
          const icon: IconName | undefined =
            typeof item.icon === 'string' && isIconName(item.icon) ? (item.icon as IconName) : undefined;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={cx(styles.itemBtn, compact && styles.itemBtnCompact)}
                title={item.title}
                onClick={() => jumpTo(item.ref)}
              >
                {icon && <Icon name={icon} size={compact ? 'md' : 'sm'} className={styles.itemIcon} />}
                {!compact && <span className={styles.itemLabel}>{item.title}</span>}
              </button>
            </li>
          );
        })}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
  }),
  listCompact: css({
    alignItems: 'center',
    gap: theme.spacing(0.25),
  }),
  itemBtn: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.75, 1.5),
    background: 'transparent',
    border: 'none',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: theme.typography.size.sm,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  itemBtnCompact: css({
    width: 32,
    height: 32,
    padding: 0,
    justifyContent: 'center',
    borderRadius: theme.shape.radius.default,
  }),
  itemIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  itemLabel: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
