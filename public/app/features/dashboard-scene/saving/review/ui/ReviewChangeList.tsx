import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';

import { type ReviewChange } from '../types';

import { ElementIcon, MarkerSlot, hasElementIcon, isAddedOrRemoved } from './ReviewMarks';
import { ReviewPropertyList } from './ReviewPropertyList';

export function ReviewChangeList({ changes }: { changes: ReviewChange[] }) {
  const styles = useStyles2(getStyles);
  // Columns are reserved for the whole list when any line needs them, so every line's text starts at the same place
  const columns = {
    // The marker column also holds the chevron of an element whose field changes are grouped
    marker: changes.some(
      (change) =>
        (change.subject && isAddedOrRemoved(change.kind)) ||
        Boolean(change.changes?.length) ||
        Boolean(change.properties?.length)
    ),
    icon: changes.some((change) => hasElementIcon(change.subject)),
  };

  return (
    <ul className={styles.list}>
      {changeKeys(changes).map((key, index) => (
        <ReviewChangeLine key={key} change={changes[index]} columns={columns} />
      ))}
    </ul>
  );
}

/**
 * Keys that follow a change across recomputes, so an open "Show" stays on its line when lines are
 * added or removed around it. A repeated key, which no well-formed summary has, is numbered to stay unique.
 */
function changeKeys(changes: ReviewChange[]): string[] {
  const seen = new Map<string, number>();
  return changes.map((change) => {
    const key = `${change.claims.join('|')}::${change.text}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? key : `${key}#${count}`;
  });
}

function ReviewChangeLine({ change, columns }: { change: ReviewChange; columns: { marker: boolean; icon: boolean } }) {
  const styles = useStyles2(getStyles);
  const [showDetails, setShowDetails] = useState(false);
  const [open, setOpen] = useState(false);
  const textId = useId();
  const contentId = useId();
  const { details } = change;
  const marked = Boolean(change.subject) && isAddedOrRemoved(change.kind);
  // An element's grouped field changes or its properties are one click away: the chevron, or its +/− when it was
  // added or removed, is the toggle.
  const expandable = Boolean(change.changes?.length || change.properties?.length);

  const lead = (columns.marker || columns.icon) && (
    <span className={styles.lead}>
      {columns.marker &&
        (expandable && !marked ? (
          <span className={styles.slot}>
            <Icon name={open ? 'angle-down' : 'angle-right'} className={styles.chevron} />
          </span>
        ) : (
          <MarkerSlot kind={marked ? change.kind : undefined} />
        ))}{' '}
      {columns.icon && (
        <span className={styles.iconSlot}>{change.subject && <ElementIcon kind={change.subject} />}</span>
      )}
    </span>
  );
  const label = (
    <>
      <span id={textId} className={styles.text}>
        {change.text}
      </span>
      {change.statusText && (
        <>
          {' '}
          <Text color="secondary">{change.statusText}</Text>
        </>
      )}
    </>
  );

  return (
    <li className={styles.line}>
      {expandable ? (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
        >
          {lead}
          {label}
        </button>
      ) : (
        <div className={styles.lineHeader}>
          {lead}
          {label}
          {details && (
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              className={styles.showButton}
              aria-expanded={showDetails}
              aria-describedby={textId}
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <Trans i18nKey="dashboard-scene.review.hide-details">Hide</Trans>
              ) : (
                <Trans i18nKey="dashboard-scene.review.show-details">Show</Trans>
              )}
            </Button>
          )}
        </div>
      )}
      {expandable && open && (
        <div id={contentId} className={styles.nested}>
          {change.properties?.length ? <ReviewPropertyList properties={change.properties} /> : null}
          {change.changes?.length ? <ReviewChangeList changes={change.changes} /> : null}
        </div>
      )}
      {details && showDetails && (
        <div className={styles.details}>
          {details.before !== undefined && (
            <ReviewValue label={t('dashboard-scene.review.value-before', 'Before')} value={details.before} />
          )}
          {details.after !== undefined && (
            <ReviewValue label={t('dashboard-scene.review.value-after', 'After')} value={details.after} />
          )}
        </div>
      )}
    </li>
  );
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  const styles = useStyles2(getStyles);

  return (
    <figure className={styles.value}>
      <figcaption>
        <Text variant="bodySmall" color="secondary">
          {label}
        </Text>
      </figcaption>
      <pre className={styles.pre}>{value}</pre>
    </figure>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  line: css({
    padding: theme.spacing(0.25, 0),
  }),
  lineHeader: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
  }),
  // As tall as the first line of text, so the marker and icon sit on it when the text wraps
  lead: css({
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    gap: theme.spacing(0.75),
    height: `calc(${theme.typography.body.fontSize} * ${theme.typography.body.lineHeight})`,
  }),
  toggle: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
    width: '100%',
    padding: 0,
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
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  slot: css({
    display: 'inline-flex',
    flexShrink: 0,
    width: theme.spacing(2),
  }),
  chevron: css({
    color: theme.colors.text.secondary,
  }),
  // A guide line, as under a node: what the element holds reads as inside it
  nested: css({
    margin: theme.spacing(0.25, 0, 0.5, 1),
    paddingLeft: theme.spacing(1.5),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  iconSlot: css({
    display: 'inline-flex',
    flexShrink: 0,
    width: theme.spacing(2),
  }),
  text: css({
    minWidth: 0,
    overflowWrap: 'anywhere',
  }),
  showButton: css({
    flexShrink: 0,
    height: 'auto',
    padding: theme.spacing(0, 0.5),
  }),
  details: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0.5, 0, 1, 3),
  }),
  value: css({
    margin: 0,
  }),
  pre: css({
    margin: theme.spacing(0.25, 0, 0),
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
