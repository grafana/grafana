import { css } from '@emotion/css';
import { FormEvent, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, FilterPill, Grid, IconButton, Input, ScrollContainer, Stack, Switch, useStyles2 } from '@grafana/ui';
import { getCategoriesLabels } from 'app/features/transformers/utils';

import { TransformationCard } from '../../../dashboard/components/TransformationsEditor/TransformationCard';
import { FilterCategory } from '../../../dashboard/components/TransformationsEditor/TransformationsEditor';

import { NewEmptyTransformationsMessage } from './EmptyTransformationsMessage';

const VIEW_ALL_VALUE = 'viewAll';

interface TransformationPickerViewProps {
  data: DataFrame[];
  onAddTransformation: (selectedItem: SelectableValue<string>, customOptions?: Record<string, unknown>) => void;
  onCancel: () => void;
  onGoToQueries?: () => void;
}

export function TransformationPickerView({
  data,
  onAddTransformation,
  onCancel,
  onGoToQueries,
}: TransformationPickerViewProps) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showIllustrations, setShowIllustrations] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>(VIEW_ALL_VALUE);

  const allTransformations = useMemo(
    () => standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0)),
    []
  );

  const filterCategoriesLabels: Array<[FilterCategory, string]> = useMemo(
    () => [
      [VIEW_ALL_VALUE, t('dashboard.transformation-picker-ng.view-all', 'View all')],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ...(Object.entries(getCategoriesLabels()) as Array<[FilterCategory, string]>),
    ],
    []
  );

  const transformations = allTransformations.filter((t) => {
    // Filter by category
    if (selectedFilter && selectedFilter !== VIEW_ALL_VALUE && !t.categories?.has(selectedFilter)) {
      return false;
    }

    // Filter by search
    const searchLower = search.toLocaleLowerCase();
    const textMatch =
      t.name.toLocaleLowerCase().includes(searchLower) || t.description?.toLocaleLowerCase().includes(searchLower);
    const tagMatch = t.tags?.size
      ? Array.from(t.tags).some((tag) => tag.toLocaleLowerCase().includes(searchLower))
      : false;
    return textMatch || tagMatch;
  });

  const onSearchChange = (e: FormEvent<HTMLInputElement>) => setSearch(e.currentTarget.value);

  const handleAddTransformation = (transformationId: string) => {
    reportInteraction('grafana_panel_transformations_clicked', {
      type: transformationId,
      context: 'transformation_picker_view',
    });
    onAddTransformation({ value: transformationId });
  };

  const searchBoxSuffix = search ? (
    <>
      {transformations.length} / {allTransformations.length} &nbsp;&nbsp;
      <IconButton
        name="times"
        onClick={() => setSearch('')}
        tooltip={t('dashboard-scene.transformation-picker-view.clear-search', 'Clear search')}
      />
    </>
  ) : undefined;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
          <h3 className={styles.title}>
            <Trans i18nKey="dashboard-scene.transformation-picker-view.title">Add transformation</Trans>
          </h3>
          <IconButton
            name="times"
            onClick={onCancel}
            tooltip={t('dashboard-scene.transformation-picker-view.close', 'Close')}
            size="lg"
          />
        </Stack>
      </div>
      {showAll && (
        <>
          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <Input
                value={search}
                onChange={onSearchChange}
                placeholder={t(
                  'dashboard-scene.transformation-picker-view.search-placeholder',
                  'Search for transformation'
                )}
                suffix={search ? searchBoxSuffix : undefined}
                autoFocus
                data-testid={selectors.components.Transforms.searchInput}
                className={styles.searchInput}
              />
              <Stack direction="row" alignItems="center" gap={0.5}>
                <span className={styles.switchLabel}>
                  <Trans i18nKey="dashboard.transformation-picker-ng.show-images">Show images</Trans>
                </span>
                <Switch value={showIllustrations} onChange={() => setShowIllustrations(!showIllustrations)} />
              </Stack>
            </div>
            <Stack direction="row" wrap="wrap" rowGap={1} columnGap={0.5}>
              {filterCategoriesLabels.map(([slug, label]) => (
                <FilterPill
                  key={slug}
                  onClick={() => setSelectedFilter(slug)}
                  label={label}
                  selected={selectedFilter === slug}
                />
              ))}
            </Stack>
          </div>
        </>
      )}
      <ScrollContainer>
        <Box padding={2}>
          {showAll ? (
            // Show all transformations when "show more" clicked
            transformations.length === 0 ? (
              <div className={styles.noResults}>
                <p>
                  <Trans i18nKey="dashboard-scene.transformation-picker-view.no-results">
                    No transformations found
                  </Trans>
                </p>
              </div>
            ) : (
              <Grid columns={3} gap={1}>
                {transformations.map((transform) => (
                  <TransformationCard
                    key={transform.id}
                    transform={transform}
                    showIllustrations={showIllustrations}
                    showPluginState={false}
                    showTags={true}
                    onClick={handleAddTransformation}
                    data={data}
                  />
                ))}
              </Grid>
            )
          ) : (
            // Show empty state with featured transformations when not searching
            <NewEmptyTransformationsMessage
              onShowPicker={() => setShowAll(true)}
              onAddTransformation={handleAddTransformation}
              onGoToQueries={onGoToQueries}
              showIllustrations={true}
            />
          )}
        </Box>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: theme.colors.background.primary,
    }),
    header: css({
      padding: theme.spacing(2, 2, 0, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(2),
    }),
    title: css({
      margin: 0,
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
    }),
    searchContainer: css({
      padding: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    searchWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: theme.spacing(2),
      rowGap: theme.spacing(1),
      width: '100%',
      paddingBottom: theme.spacing(1),
    }),
    searchInput: css({
      flexGrow: 1,
      width: 'initial',
    }),
    switchLabel: css({
      whiteSpace: 'nowrap',
    }),
    noResults: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h5.fontSize,
    }),
  };
};
