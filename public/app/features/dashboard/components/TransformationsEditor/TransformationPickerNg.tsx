import { css } from '@emotion/css';
import { FormEventHandler, KeyboardEventHandler, ReactNode, useCallback } from 'react';

import { DataFrame, GrafanaTheme2, TransformerRegistryItem, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Drawer, FilterPill, Grid, Input, Stack, Switch, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { getCategoriesLabels } from 'app/features/transformers/utils';

import { SqlExpressionsBanner } from './SqlExpressions/SqlExpressionsBanner';
import { TransformationCard } from './TransformationCard';
import { FilterCategory } from './TransformationsEditor';

const VIEW_ALL_VALUE = 'viewAll';

interface TransformationPickerNgProps {
  onTransformationAdd: (selectedItem: SelectableValue<string>) => void;
  onSearchChange: FormEventHandler<HTMLInputElement>;
  onSearchKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onClose?: () => void;
  noTransforms: boolean;
  xforms: TransformerRegistryItem[];
  search: string;
  suffix: ReactNode;
  data: DataFrame[];
  showIllustrations?: boolean;
  onShowIllustrationsChange?: (showIllustrations: boolean) => void;
  onSelectedFilterChange?: (category: FilterCategory) => void;
  selectedFilter?: FilterCategory;
}

export function TransformationPickerNg(props: TransformationPickerNgProps) {
  const styles = useStyles2(getTransformationPickerStyles);
  const {
    suffix,
    xforms,
    search,
    onSearchChange,
    onSearchKeyDown,
    showIllustrations,
    onTransformationAdd,
    selectedFilter,
    data,
    onClose,
    onShowIllustrationsChange,
    onSelectedFilterChange,
  } = props;

  const filterCategoriesLabels: Array<[FilterCategory, string]> = [
    [VIEW_ALL_VALUE, t('dashboard.transformation-picker-ng.view-all', 'View all')],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ...(Object.entries(getCategoriesLabels()) as Array<[FilterCategory, string]>),
  ];

  // Use a callback ref to call "click" on the search input
  // This will focus it when it's opened
  const searchInputRef = useCallback((input: HTMLInputElement) => {
    input?.click();
  }, []);

  return (
    <Drawer
      size="md"
      onClose={() => {
        onClose && onClose();
      }}
      title={t('dashboard.transformation-picker-ng.title-add-another-transformation', 'Add another transformation')}
    >
      <Stack direction="column" gap={2}>
        {config?.featureToggles?.sqlExpressions && <SqlExpressionsBanner />}
        <div className={styles.searchWrapper}>
          <Input
            data-testid={selectors.components.Transforms.searchInput}
            className={styles.searchInput}
            value={search ?? ''}
            placeholder={t(
              'dashboard.transformation-picker-ng.placeholder-search-for-transformation',
              'Search for transformation'
            )}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            suffix={suffix}
            ref={searchInputRef}
            autoFocus={true}
          />
          <Stack direction="row" alignItems="center" gap={0.5}>
            <span className={styles.switchLabel}>
              <Trans i18nKey="dashboard.transformation-picker-ng.show-images">Show images</Trans>
            </span>
            <Switch
              value={showIllustrations}
              onChange={() => onShowIllustrationsChange && onShowIllustrationsChange(!showIllustrations)}
            />
          </Stack>
        </div>

        <Stack direction="row" wrap="wrap" rowGap={1} columnGap={0.5}>
          {filterCategoriesLabels.map(([slug, label]) => {
            return (
              <FilterPill
                key={slug}
                onClick={() => onSelectedFilterChange && onSelectedFilterChange(slug)}
                label={label}
                selected={selectedFilter === slug}
              />
            );
          })}
        </Stack>

        <TransformationsGrid
          showIllustrations={showIllustrations}
          transformations={xforms}
          data={data}
          onClick={(id) => {
            reportInteraction('grafana_panel_transformations_clicked', {
              type: id,
              context: 'transformations_drawer',
            });
            onTransformationAdd({ value: id });
          }}
        />
      </Stack>
    </Drawer>
  );
}

function getTransformationPickerStyles(theme: GrafanaTheme2) {
  return {
    pickerInformationLine: css({
      fontSize: '16px',
      marginBottom: theme.spacing(2),
    }),
    pickerInformationLineHighlight: css({
      verticalAlign: 'middle',
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
      flexGrow: '1',
      width: 'initial',
    }),
    switchLabel: css({
      whiteSpace: 'nowrap',
    }),
  };
}

interface TransformationsGridProps {
  transformations: TransformerRegistryItem[];
  showIllustrations?: boolean;
  onClick: (id: string) => void;
  data: DataFrame[];
}

function TransformationsGrid({ showIllustrations, transformations, onClick, data }: TransformationsGridProps) {
  return (
    <Grid columns={3} gap={1}>
      {transformations.map((transform) => (
        <TransformationCard
          key={transform.id}
          transform={transform}
          showIllustrations={showIllustrations}
          onClick={onClick}
          data={data}
        />
      ))}
    </Grid>
  );
}
