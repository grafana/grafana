import { css } from '@emotion/css';
import { ChangeEvent, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EmptyState, FilterPill, Grid, IconButton, Input, Stack, Switch, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { SqlExpressionsBanner } from 'app/features/dashboard/components/TransformationsEditor/SqlExpressions/SqlExpressionsBanner';
import { TransformationCard } from 'app/features/dashboard/components/TransformationsEditor/TransformationCard';

import { useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { useTransformationSearchAndFilter } from './useTransformationSearchAndFilter';

export function TransformationTypePicker() {
  const styles = useStyles2(getStyles);

  const { finalizePendingTransformation } = useQueryEditorUIContext();
  const { data } = useQueryRunnerContext();

  const [showIllustrations, setShowIllustrations] = useState(true);

  const {
    search,
    setSearch,
    selectedFilter,
    setSelectedFilter,
    categories,
    filteredTransformations,
    onSearchKeyDown,
    allTransformationsCount,
  } = useTransformationSearchAndFilter(finalizePendingTransformation);

  const searchBoxSuffix = useMemo(() => {
    if (filteredTransformations.length === allTransformationsCount) {
      return null;
    }
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        {filteredTransformations.length} / {allTransformationsCount}
        <IconButton
          name="times"
          onClick={() => setSearch('')}
          tooltip={t('dashboard.transformation-picker-ng.clear-search', 'Clear search')}
        />
      </Stack>
    );
  }, [filteredTransformations.length, allTransformationsCount, setSearch]);

  return (
    <Stack direction="column" gap={2}>
      {config?.featureToggles?.sqlExpressions && <SqlExpressionsBanner />}

      <div className={styles.searchWrapper}>
        <Input
          autoFocus
          data-testid={selectors.components.Transforms.searchInput}
          className={styles.searchInput}
          value={search}
          placeholder={t(
            'dashboard.transformation-picker-ng.placeholder-search-for-transformation',
            'Search for transformation'
          )}
          onChange={({ target: { value } }: ChangeEvent<HTMLInputElement>) => setSearch(value)}
          onKeyDown={onSearchKeyDown}
          suffix={searchBoxSuffix}
        />
        <Stack direction="row" alignItems="center" gap={0.5}>
          <div className={styles.switchLabel}>
            <Trans i18nKey="dashboard.transformation-picker-ng.show-images">Show images</Trans>
          </div>
          <Switch value={showIllustrations} onChange={() => setShowIllustrations((prev) => !prev)} />
        </Stack>
      </div>

      <Stack direction="row" wrap="wrap" rowGap={1} columnGap={0.5}>
        <FilterPill
          label={t('dashboard.transformation-picker-ng.view-all', 'View all')}
          selected={selectedFilter === null}
          onClick={() => setSelectedFilter(null)}
        />
        {categories.map(({ slug, label }) => (
          <FilterPill
            key={slug}
            label={label}
            selected={selectedFilter === slug}
            onClick={() => setSelectedFilter(selectedFilter === slug ? null : slug)}
          />
        ))}
      </Stack>

      {filteredTransformations.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={t('dashboard.transformation-picker-ng.no-transformations-found', 'No transformations found')}
        />
      ) : (
        <Grid columns={3} gap={1}>
          {filteredTransformations.map((item) => (
            <TransformationCard
              key={item.id}
              transform={item}
              data={data?.series ?? []}
              onClick={(id) => finalizePendingTransformation(id)}
              showIllustrations={showIllustrations}
              fullWidth
            />
          ))}
        </Grid>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    searchWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: theme.spacing(2),
      rowGap: theme.spacing(1),
      width: '100%',
    }),
    searchInput: css({
      flexGrow: 1,
      width: 'initial',
    }),
    switchLabel: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
