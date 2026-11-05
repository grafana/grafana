import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { type ReviewProperty } from '../types';

/** What an added or removed element is set to: literal values inline, lists and objects behind Show. */
export function ReviewPropertyList({ properties }: { properties: ReviewProperty[] }) {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.list}>
      {properties.map((item, index) => (
        <ReviewPropertyLine key={`${item.label}#${index}`} property={item} />
      ))}
    </ul>
  );
}

function ReviewPropertyLine({ property }: { property: ReviewProperty }) {
  const styles = useStyles2(getStyles);
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
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            className={styles.showButton}
            aria-expanded={open}
            aria-describedby={labelId}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <Trans i18nKey="dashboard-scene.review.hide-details">Hide</Trans>
            ) : (
              <Trans i18nKey="dashboard-scene.review.show-details">Show</Trans>
            )}
          </Button>
        )}
      </div>
      {property.details !== undefined && open && <pre className={styles.pre}>{property.details}</pre>}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
  pre: css({
    margin: theme.spacing(0.5, 0, 1),
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
