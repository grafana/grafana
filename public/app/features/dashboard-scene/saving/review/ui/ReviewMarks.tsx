import { css } from '@emotion/css';
import { upperFirst } from 'lodash';
import { Fragment } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

import { kindWord } from '../richText';
import { type NamedElement, type ReviewElementKind, type ReviewNode, type RichText } from '../types';

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
export function MarkerSlot({ kind, decorative }: { kind?: string; decorative?: boolean }) {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.slot}>
      {isAddedOrRemoved(kind) && <AddRemoveMarker kind={kind} decorative={decorative} />}
    </span>
  );
}

/** Decorative unless given an aria-label, which makes it an image screen readers name. */
export function ElementIcon({ kind, 'aria-label': ariaLabel }: { kind: ReviewElementKind; 'aria-label'?: string }) {
  const styles = useStyles2(getStyles);

  const name = ELEMENT_ICONS[kind];
  if (!name) {
    return null;
  }

  return ariaLabel ? (
    <Icon name={name} size="sm" className={styles.elementIcon} role="img" aria-label={ariaLabel} />
  ) : (
    <Icon name={name} size="sm" className={styles.elementIcon} />
  );
}

/**
 * Translated text with named elements: each element shows its kind as an icon before its name. The header's
 * own element (`self`) has its icon at the start of the header already, so only its name is shown.
 * Screen readers hear the kind word either way. `capitalize` upper-cases the first string part only.
 */
export function RichTextView({ text, capitalize = false }: { text: RichText; capitalize?: boolean }) {
  const firstString = capitalize ? text.findIndex((part) => typeof part === 'string') : -1;

  return (
    <>
      {text.map((part, index) =>
        typeof part === 'string' ? (
          <Fragment key={index}>{index === firstString ? upperFirst(part) : part}</Fragment>
        ) : (
          <NamedElementView key={index} element={part} />
        )
      )}
    </>
  );
}

function NamedElementView({ element }: { element: NamedElement }) {
  const styles = useStyles2(getStyles);
  const word = kindWord(element.kind);

  if (element.self) {
    return (
      <span>
        <span className={styles.visuallyHidden}>{`${word} `}</span>
        {element.name}
      </span>
    );
  }

  // The space keeps the kind word and the name apart in the accessible name; flex layout ignores it
  return (
    <span className={styles.named}>
      <ElementIcon kind={element.kind} aria-label={word} /> {element.name}
    </span>
  );
}

/**
 * A green + or red − for an element that is added or removed; screen readers hear the word, unless
 * `decorative` says the text next to it already has it.
 */
export function AddRemoveMarker({ kind, decorative }: { kind: 'added' | 'removed'; decorative?: boolean }) {
  const styles = useStyles2(getStyles);
  const label =
    kind === 'added'
      ? t('dashboard-scene.review.marker-added', 'Added')
      : t('dashboard-scene.review.marker-removed', 'Removed');

  if (decorative) {
    return (
      <span aria-hidden className={styles.marker[kind]}>
        <Icon name={kind === 'added' ? 'plus' : 'minus'} size="xs" />
      </span>
    );
  }

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
    named: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      verticalAlign: 'bottom',
    }),
    visuallyHidden: css({
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
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
