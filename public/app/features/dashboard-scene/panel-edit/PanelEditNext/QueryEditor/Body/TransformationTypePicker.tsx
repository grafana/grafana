import { css } from '@emotion/css';
import { type ChangeEvent, useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { EmptyState, FilterPill, Grid, IconButton, Input, Stack, Switch } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import config from 'app/core/config';
import { TransformationCard } from 'app/features/dashboard/components/TransformationsEditor/TransformationCard';
import { hasBackendDatasource } from 'app/features/dashboard-scene/panel-edit/PanelDataPane/utils';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { trackTransformationFilterChanged, trackTransformationSearch } from '../../tracking';
import { useDatasourceContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { SqlExpressionsCTA } from './SqlExpressionsCTA';
import { useTransformationSearchAndFilter } from './useTransformationSearchAndFilter';

export function TransformationTypePicker() {
  const styles = useStyles2(getStyles);

  const { finalizePendingTransformation, setPendingTransformation, finalizePendingExpression } =
    useQueryEditorUIContext();
  const { data, queries } = useQueryRunnerContext();
  const { dsSettings } = useDatasourceContext();

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

  const showSqlCTA =
    config.featureToggles.sqlExpressions && hasBackendDatasource({ datasourceUid: dsSettings?.uid, queries });

  const handleAddSqlExpression = useCallback(() => {
    reportInteraction('dashboards_expression_interaction', {
      action: 'add_expression',
      expression_type: 'sql',
      context: 'transformation_picker_cta',
    });
    setPendingTransformation(null);
    finalizePendingExpression(ExpressionQueryType.sql);
  }, [setPendingTransformation, finalizePendingExpression]);

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
          onChange={({ target: { value } }: ChangeEvent<HTMLInputElement>) => {
            setSearch(value);
            trackTransformationSearch(value);
          }}
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

      {showSqlCTA && <SqlExpressionsCTA onAddSqlExpression={handleAddSqlExpression} />}

      <Stack direction="row" wrap="wrap" rowGap={1} columnGap={0.5}>
        <FilterPill
          label={t('dashboard.transformation-picker-ng.view-all', 'View all')}
          selected={selectedFilter === null}
          onClick={() => {
            setSelectedFilter(null);
            trackTransformationFilterChanged(null);
          }}
        />
        {categories.map(({ slug, label }) => (
          <FilterPill
            key={slug}
            label={label}
            selected={selectedFilter === slug}
            onClick={() => {
              const next = selectedFilter === slug ? null : slug;
              setSelectedFilter(next);
              trackTransformationFilterChanged(next);
            }}
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
