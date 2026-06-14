import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, IconButton, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { type RichHistoryQuery } from 'app/types/explore';
import icnDatasourceSvg from 'img/icn-datasource.svg';

type Props = {
  query: RichHistoryQuery;
  queryDisplayText: string;
  datasourceLogo?: string;
  onSelectQuery: (query: RichHistoryQuery) => void;
  onStarQuery: (id: string, starred: boolean) => void;
  onSaveQuery?: (query: RichHistoryQuery) => void;
};

export function RecentQueryRow({
  query,
  queryDisplayText,
  datasourceLogo,
  onSelectQuery,
  onStarQuery,
  onSaveQuery,
}: Props) {
  const styles = useStyles2(getStyles);
  const [showStarTooltip, setShowStarTooltip] = useState(false);

  const formattedDate = dateTimeFormat(query.createdAt, { format: 'MMM D, YYYY' });
  const logoSrc = datasourceLogo ?? icnDatasourceSvg;

  const handleStar = useCallback(() => {
    if (query.starred) {
      onStarQuery(query.id, false);
    } else {
      onStarQuery(query.id, true);
      setShowStarTooltip(true);
    }
  }, [query.starred, query.id, onStarQuery]);

  const handleSave = useCallback(() => {
    onSaveQuery?.(query);
  }, [onSaveQuery, query]);

  const handleSelect = useCallback(() => {
    onSelectQuery(query);
  }, [onSelectQuery, query]);

  // Dismiss the star tooltip when clicking outside the card
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showStarTooltip) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      // Keep the tooltip open for clicks inside the card or the tooltip portal
      if (e.target instanceof Node && cardRef.current?.contains(e.target)) {
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest('[role="tooltip"]')) {
        return;
      }
      setShowStarTooltip(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showStarTooltip]);

  const starButton = (
    <IconButton
      aria-label={query.starred ? t('recent-queries.row.unstar', 'Unstar') : t('recent-queries.row.star', 'Star')}
      name={query.starred ? 'favorite' : 'star'}
      iconType={query.starred ? 'mono' : 'default'}
      onClick={handleStar}
    />
  );

  const tooltipContent = <span>{t('recent-queries.row.star-tooltip', 'Query starred!')}</span>;

  const actionButton = onSaveQuery ? (
    <Button variant="secondary" size="sm" onClick={handleSave}>
      {t('recent-queries.row.save', 'Save query')}
    </Button>
  ) : showStarTooltip ? (
    <Tooltip content={tooltipContent} show={true} interactive placement="top">
      {starButton}
    </Tooltip>
  ) : (
    starButton
  );

  return (
    <div ref={cardRef} className={styles.card} data-testid="recent-query-row">
      <div className={styles.textContent}>
        <div className={styles.metaRow}>
          <img className={styles.dsIcon} src={logoSrc} alt={query.datasourceName} />
          <Text variant="bodySmall" color="secondary" truncate>
            {query.datasourceName}
          </Text>
          <Icon name="calendar-alt" size="sm" className={styles.calendarIcon} />
          <Text variant="bodySmall" color="secondary">
            {formattedDate}
          </Text>
        </div>
        <div className={styles.queryText}>
          <Text truncate>{queryDisplayText}</Text>
        </div>
      </div>
      <div className={styles.actions}>
        {actionButton}
        <Button variant="primary" size="sm" onClick={handleSelect}>
          {t('recent-queries.row.select-query', 'Select query')}
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
  }),
  textContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    flex: 1,
    minWidth: 0,
  }),
  metaRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  dsIcon: css({
    width: '16px',
    height: '16px',
    flexShrink: 0,
    objectFit: 'contain',
  }),
  calendarIcon: css({
    marginLeft: theme.spacing(1),
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  queryText: css({
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
});
