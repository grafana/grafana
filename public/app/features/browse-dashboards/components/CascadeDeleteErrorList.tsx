import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

const COLLAPSE_THRESHOLD = 5;

interface Props {
  errors: string[];
}

/**
 * Renders cascade-delete errors as a bulleted list (a flat run of prose reads as unstructured
 * mush once there's more than a couple), collapsing to the first COLLAPSE_THRESHOLD with a
 * "show more" toggle once there are more than that -- mirrors the general shape of provisioning's
 * sync-error display (Shared/MessageList.tsx) without reusing it directly, since that component
 * collapses after just one message rather than a handful.
 */
export function CascadeDeleteErrorList({ errors }: Props) {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);
  const isTruncated = errors.length > COLLAPSE_THRESHOLD;
  const visibleErrors = expanded || !isTruncated ? errors : errors.slice(0, COLLAPSE_THRESHOLD);

  return (
    <>
      <ul className={styles.list}>
        {visibleErrors.map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
      {isTruncated && (
        <button type="button" className={styles.toggle} onClick={() => setExpanded((prev) => !prev)}>
          {expanded
            ? t('browse-dashboards.cascade-delete-error-list.show-less', 'Show less')
            : t('browse-dashboards.cascade-delete-error-list.show-more', '', {
                count: errors.length - COLLAPSE_THRESHOLD,
                defaultValue_one: 'Show {{count}} more error',
                defaultValue_other: 'Show {{count}} more errors',
              })}
        </button>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    margin: 0,
    paddingLeft: theme.spacing(3),
    listStyle: 'disc',
  }),
  toggle: css({
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    marginTop: theme.spacing(0.5),
    textDecoration: 'underline',
    cursor: 'pointer',
    color: theme.colors.text.primary,
  }),
});
