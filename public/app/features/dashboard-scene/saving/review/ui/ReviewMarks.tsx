import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

import { type ReviewElementKind, type ReviewNode } from '../types';

/**
 * The icons the content outline and the panel editor use for each kind of element. Tags, overrides and
 * show/hide rules have none there, so they get none here: the line's text names what they are.
 */
const ELEMENT_ICONS: Record<ReviewElementKind, IconName | undefined> = {
  dashboard: 'apps',
  panel: 'chart-line',
  row: 'list-ul',
  tab: 'layers',
  variable: 'gf-variable',
  adHocFilter: 'filter',
  annotation: 'comment-alt',
  link: 'external-link-alt',
  query: 'database',
  transformation: 'calculator-alt',
  tag: undefined,
  override: undefined,
  rule: undefined,
};

export function nodeElementKind(node: ReviewNode): ReviewElementKind {
  return node.kind === 'section' ? node.sectionKind : node.kind;
}

export function hasElementIcon(kind: ReviewElementKind | undefined): boolean {
  return kind !== undefined && ELEMENT_ICONS[kind] !== undefined;
}

export function isAddedOrRemoved(kind: string | undefined): kind is 'added' | 'removed' {
  return kind === 'added' || kind === 'removed';
}

/**
 * A fixed-width column for the +/− marker. Siblings reserve it when any of them has a marker, so their icons
 * and labels line up whether or not they were added or removed.
 */
export function MarkerSlot({ kind }: { kind?: string }) {
  const styles = useStyles2(getStyles);

  return <span className={styles.slot}>{isAddedOrRemoved(kind) && <AddRemoveMarker kind={kind} />}</span>;
}

export function ElementIcon({ kind }: { kind: ReviewElementKind }) {
  const styles = useStyles2(getStyles);

  const name = ELEMENT_ICONS[kind];

  return name ? <Icon name={name} size="sm" className={styles.elementIcon} /> : null;
}

/** A green + or red − for an element that is added or removed; screen readers hear the word. */
export function AddRemoveMarker({ kind }: { kind: 'added' | 'removed' }) {
  const styles = useStyles2(getStyles);
  const label =
    kind === 'added'
      ? t('dashboard-scene.review.marker-added', 'Added')
      : t('dashboard-scene.review.marker-removed', 'Removed');

  return (
    <span role="img" aria-label={label} className={styles.marker[kind]}>
      <Icon name={kind === 'added' ? 'plus' : 'minus'} size="xs" />
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const marker = (color: { text: string; transparent: string }) =>
    css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: theme.spacing(2),
      height: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      color: color.text,
      background: color.transparent,
      fontWeight: theme.typography.fontWeightBold,
      lineHeight: 1,
    });

  return {
    elementIcon: css({
      flexShrink: 0,
      color: theme.colors.text.secondary,
    }),
    slot: css({
      display: 'inline-flex',
      flexShrink: 0,
      width: theme.spacing(2),
    }),
    marker: {
      added: marker(theme.colors.success),
      removed: marker(theme.colors.error),
    },
  };
};
