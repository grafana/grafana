import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, Input, useStyles2 } from '@grafana/ui';

import { useRulesFilter } from '../../../hooks/useFilteredRules';

interface Props {
  filterCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export function SearchRow({ filterCount, filtersOpen, onToggleFilters }: Props) {
  const styles = useStyles2(getStyles);
  const { searchQuery, setSearchQuery } = useRulesFilter();
  const [localValue, setLocalValue] = useState(searchQuery);

  // Keep the local input value in sync when the URL/filter panel writes a new search string.
  useEffect(() => {
    setLocalValue(searchQuery);
  }, [searchQuery]);

  function commit(next: string) {
    setSearchQuery(next || undefined);
  }

  return (
    <div className={styles.row}>
      <div className={styles.searchWrap}>
        <Input
          placeholder={t('alerting.rule-list-v2.search-placeholder', 'Search by name or enter filter query...')}
          prefix={<Icon name="search" />}
          value={localValue}
          onChange={(e) => setLocalValue(e.currentTarget.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget instanceof HTMLInputElement) {
              commit(e.currentTarget.value);
            }
          }}
        />
      </div>
      <Button variant="secondary" icon="bookmark">
        <Trans i18nKey="alerting.rule-list-v2.saved-searches">Saved searches</Trans>
      </Button>
      <Button
        variant="secondary"
        icon="filter"
        aria-expanded={filtersOpen}
        aria-controls="rule-list-v2-filter-panel"
        onClick={onToggleFilters}
      >
        <Trans i18nKey="alerting.rule-list-v2.filters">Filters</Trans>
        {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
      </Button>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    searchWrap: css({
      flex: 1,
    }),
    badge: css({
      marginLeft: theme.spacing(0.5),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(2.25),
      height: theme.spacing(2.25),
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1,
    }),
  };
}
