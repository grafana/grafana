import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { type ReviewChange } from '../types';

import { ElementIcon, MarkerSlot, hasElementIcon, isAddedOrRemoved } from './ReviewMarks';

export function ReviewChangeList({ changes }: { changes: ReviewChange[] }) {
  const styles = useStyles2(getStyles);
  // Columns are reserved for the whole list when any line needs them, so every line's text starts at the same place
  const columns = {
    marker: changes.some((change) => change.subject && isAddedOrRemoved(change.kind)),
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
  const textId = useId();
  const { details } = change;

  return (
    <li className={styles.line}>
      <div className={styles.lineHeader}>
        {/* An element line is only the element's name: the marker says what happened to it */}
        {(columns.marker || columns.icon) && (
          <span className={styles.lead}>
            {columns.marker && <MarkerSlot kind={change.subject ? change.kind : undefined} />}{' '}
            {columns.icon && (
              <span className={styles.iconSlot}>{change.subject && <ElementIcon kind={change.subject} />}</span>
            )}
          </span>
        )}
        <span id={textId} className={styles.text}>
          {change.text}
        </span>
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
