import { css, cx } from '@emotion/css';
import { type CSSObject } from '@emotion/react';
import { upperFirst } from 'lodash';
import { Fragment, type ReactNode, useId, useMemo, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { kindWord } from '../richText';
import {
  type LazyText,
  type NamedElement,
  type ReviewElementKind,
  type ReviewNode,
  type ReviewProperty,
  type RichText,
} from '../types';

// --- Marks ---

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
  return <Slot>{isAddedOrRemoved(kind) && <AddRemoveMarker kind={kind} decorative={decorative} />}</Slot>;
}

/** A fixed-width column for a marker, chevron or icon, so the text after it starts at the same place on every line. */
export function Slot({ className, children }: { className?: string; children?: ReactNode }) {
  const styles = useStyles2(getMarkStyles);

  return <span className={cx(styles.slot, className)}>{children}</span>;
}

/** Decorative unless given an aria-label, which makes it an image screen readers name. */
export function ElementIcon({ kind, 'aria-label': ariaLabel }: { kind: ReviewElementKind; 'aria-label'?: string }) {
  const styles = useStyles2(getMarkStyles);

  const name = ELEMENT_ICONS[kind];
  if (!name) {
    return null;
  }

  return (
    <Icon
      name={name}
      size="sm"
      className={styles.elementIcon}
      {...(ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : {})}
    />
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
  const styles = useStyles2(getMarkStyles);
  const word = kindWord(element.kind);

  if (element.self) {
    return (
      <span>
        <span className="sr-only">{`${word} `}</span>
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
  const styles = useStyles2(getMarkStyles);
  const label =
    kind === 'added'
      ? t('dashboard-scene.review.marker-added', 'Added')
      : t('dashboard-scene.review.marker-removed', 'Removed');

  return (
    <span
      className={styles.marker[kind]}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <Icon name={kind === 'added' ? 'plus' : 'minus'} size="xs" />
    </span>
  );
}

const getMarkStyles = (theme: GrafanaTheme2) => {
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

// --- Disclosure ---

interface Props {
  /** Heading level of the header; deep nesting is capped at 6. */
  level: number;
  /** Header content: label, status and, when collapsed, the summary. */
  header: ReactNode;
  /** Undefined renders a plain header: there is nothing to reveal. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Shown where the chevron is (e.g. the +/− marker); on a collapsible header it replaces the chevron as the toggle. */
  lead?: ReactNode;
  children?: ReactNode;
}

/** A heading whose button shows or hides the content below it. */
export function ReviewDisclosure({ level, header, expanded, onToggle, lead, children }: Props) {
  const styles = useStyles2(getDisclosureStyles);
  const contentId = useId();
  const collapsible = expanded !== undefined && onToggle !== undefined;

  return (
    <div>
      <div role="heading" aria-level={Math.min(level, 6)} className={styles.heading}>
        {collapsible ? (
          <button
            type="button"
            className={styles.button}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={onToggle}
          >
            {lead ? (
              <Slot className={styles.leadSlot}>{lead}</Slot>
            ) : (
              <Icon name={expanded ? 'angle-down' : 'angle-right'} className={styles.chevron} />
            )}
            <span className={styles.header}>{header}</span>
          </button>
        ) : (
          <span className={styles.plain}>
            <Slot className={styles.leadSlot}>{lead}</Slot>
            <span className={styles.header}>{header}</span>
          </span>
        )}
      </div>
      {collapsible && expanded && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A full-width button that reads as part of the text: a disclosure header, or a line that opens what it groups. */
export const toggleStyles = (theme: GrafanaTheme2): CSSObject => ({
  display: 'flex',
  alignItems: 'flex-start',
  width: '100%',
  background: 'none',
  border: 'none',
  borderRadius: theme.shape.radius.default,
  color: theme.colors.text.primary,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover': {
    background: theme.colors.action.hover,
  },
  // Inset, so the ring isn't clipped by the scroll container at the pane's edges
  '&:focus-visible': getFocusStyles(theme, true),
});

const getDisclosureStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.body.lineHeight,
  }),
  button: css({
    ...toggleStyles(theme),
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
  }),
  plain: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
  }),
  chevron: css({
    flexShrink: 0,
    marginTop: '2px',
    color: theme.colors.text.secondary,
  }),
  // As tall as the first line of text, so a marker in place of the chevron is centred on it
  leadSlot: css({
    alignItems: 'center',
    height: `calc(${theme.typography.body.fontSize} * ${theme.typography.body.lineHeight})`,
  }),
  header: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.25),
    minWidth: 0,
  }),
  // A guide line from under the chevron: what a node contains reads as inside it, and a sibling header
  // (whose label sits where the content starts) can't be mistaken for part of it
  content: css({
    marginLeft: theme.spacing(1),
    paddingLeft: theme.spacing(1.5),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
});

// --- Property list ---

/** What an added or removed element is set to: literal values inline, lists and objects behind Show. */
export function ReviewPropertyList({ properties }: { properties: ReviewProperty[] }) {
  const styles = useStyles2(getPropertyListStyles);

  return (
    <ul className={styles.list}>
      {properties.map((item, index) => (
        <ReviewPropertyLine key={`${item.label}#${index}`} property={item} />
      ))}
    </ul>
  );
}

function ReviewPropertyLine({ property }: { property: ReviewProperty }) {
  const styles = useStyles2(getPropertyListStyles);
  const [open, setOpen] = useState(false);
  const labelId = useId();

  return (
    <li className={styles.line}>
      <div className={styles.header}>
        <span id={labelId} className={styles.text}>
          {property.value !== undefined ? (
            <>
              <span className={styles.label}>{property.label}:</span> {property.value}
            </>
          ) : (
            <span className={styles.label}>{property.label}</span>
          )}
        </span>
        {property.details !== undefined && (
          <ShowValueToggle open={open} describedBy={labelId} onToggle={() => setOpen(!open)} />
        )}
      </div>
      {property.details !== undefined && open && <ValueBlock className={styles.details} value={property.details} />}
    </li>
  );
}

/** Show/Hide for a value too long for its line; screen readers hear the line's text (`describedBy`) with it. */
export function ShowValueToggle({
  open,
  describedBy,
  onToggle,
}: {
  open: boolean;
  describedBy: string;
  onToggle: () => void;
}) {
  const styles = useStyles2(getPropertyListStyles);

  return (
    <Button
      size="sm"
      variant="secondary"
      fill="text"
      className={styles.showButton}
      aria-expanded={open}
      aria-describedby={describedBy}
      onClick={onToggle}
    >
      {open ? (
        <Trans i18nKey="dashboard-scene.review.hide-details">Hide</Trans>
      ) : (
        <Trans i18nKey="dashboard-scene.review.show-details">Show</Trans>
      )}
    </Button>
  );
}

/** A value shown in full, as written; `className` sets its margins. */
export function ValueBlock({ className, value }: { className?: string; value: LazyText }) {
  const styles = useStyles2(getPropertyListStyles);
  const text = useMemo(() => value(), [value]);

  return <pre className={cx(styles.pre, className)}>{text}</pre>;
}

const getPropertyListStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    margin: theme.spacing(0.5, 0, 1),
    padding: 0,
  }),
  line: css({
    padding: theme.spacing(0.25, 0),
  }),
  header: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
  }),
  text: css({
    minWidth: 0,
    overflowWrap: 'anywhere',
  }),
  label: css({
    color: theme.colors.text.secondary,
  }),
  showButton: css({
    flexShrink: 0,
    height: 'auto',
    padding: theme.spacing(0, 0.5),
  }),
  details: css({
    margin: theme.spacing(0.5, 0, 1),
  }),
  pre: css({
    margin: 0,
    padding: theme.spacing(1),
    maxHeight: 320,
    overflow: 'auto',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

// --- Expansion ---

export interface ReviewExpansion {
  isExpanded(key: string): boolean;
  toggle(key: string): void;
  setAll(expanded: boolean): void;
  subscribe(onChange: () => void): () => void;
}

/** What the user set: one value for everything, then per-key overrides. Undefined falls back to the default. */
class ExpansionState {
  private all: boolean | undefined;
  private overrides = new Map<string, boolean>();
  private listeners = new Set<() => void>();

  get(key: string): boolean | undefined {
    return this.overrides.get(key) ?? this.all;
  }

  set(key: string, expanded: boolean) {
    this.overrides.set(key, expanded);
    this.notify();
  }

  setAll(expanded: boolean) {
    this.all = expanded;
    this.overrides.clear();
    this.notify();
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Open/closed state of every collapsible part of the Review, by key. Expand all and Collapse all set
 * one value for everything; toggling a single part afterwards overrides it for that part only.
 *
 * The returned object changes only with `defaultExpanded`, and parts read their state with `useIsExpanded`,
 * so a toggle re-renders the parts it opens or closes rather than the whole tree.
 */
export function useReviewExpansion(defaultExpanded: (key: string) => boolean): ReviewExpansion {
  const [state] = useState(() => new ExpansionState());

  return useMemo(() => {
    const isExpanded = (key: string) => state.get(key) ?? defaultExpanded(key);

    return {
      isExpanded,
      toggle: (key) => state.set(key, !isExpanded(key)),
      setAll: (expanded) => state.setAll(expanded),
      subscribe: (onChange) => state.subscribe(onChange),
    };
  }, [state, defaultExpanded]);
}

/** Whether the part with this key is open; re-renders the caller only when that changes. */
export function useIsExpanded(expansion: ReviewExpansion, key: string): boolean {
  return useSyncExternalStore(expansion.subscribe, () => expansion.isExpanded(key));
}
