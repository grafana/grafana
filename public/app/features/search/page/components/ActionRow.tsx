import { css } from '@emotion/css';
import React, { FC, FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HorizontalGroup, RadioButtonGroup, useStyles2, Checkbox, Button } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';

import { DashboardQuery, SearchLayout } from '../../types';

import { getSortOptions } from './sorting';

export const layoutOptions = [
  { value: SearchLayout.Folders, icon: 'folder', ariaLabel: 'View by folders' },
  { value: SearchLayout.List, icon: 'list-ul', ariaLabel: 'View as list' },
];

if (config.featureToggles.dashboardPreviews) {
  layoutOptions.push({ value: SearchLayout.Grid, icon: 'apps', ariaLabel: 'Grid view' });
}

interface Props {
  onLayoutChange: (layout: SearchLayout) => void;
  onSortChange: (value: SelectableValue) => void;
  onStarredFilterChange?: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: (tags: string[]) => void;
  getTagOptions: () => Promise<TermCount[]>;
  onDatasourceChange: (ds?: string) => void;
  query: DashboardQuery;
  showStarredFilter?: boolean;
  hideLayout?: boolean;
}

export function getValidQueryLayout(q: DashboardQuery): SearchLayout {
  const layout = q.layout ?? SearchLayout.Folders;

  // Folders is not valid when a query exists
  if (layout === SearchLayout.Folders) {
    if (q.query || q.sort) {
      return SearchLayout.List;
    }
  }

  if (layout === SearchLayout.Grid && !config.featureToggles.dashboardPreviews) {
    return SearchLayout.List;
  }
  return layout;
}

export const ActionRow: FC<Props> = ({
  onLayoutChange,
  onSortChange,
  onStarredFilterChange = () => {},
  onTagFilterChange,
  getTagOptions,
  onDatasourceChange,
  query,
  showStarredFilter,
  hideLayout,
}) => {
  const styles = useStyles2(getStyles);
  const layout = getValidQueryLayout(query);

  // Disabled folder layout option when query is present
  const disabledOptions = query.query ? [SearchLayout.Folders] : [];

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          {!hideLayout && (
            <RadioButtonGroup
              options={layoutOptions}
              disabledOptions={disabledOptions}
              onChange={onLayoutChange}
              value={layout}
            />
          )}
          <SortPicker onChange={onSortChange} value={query.sort?.value} getSortOptions={getSortOptions} isClearable />
        </HorizontalGroup>
      </div>
      <HorizontalGroup spacing="md" width="auto">
        {showStarredFilter && (
          <div className={styles.checkboxWrapper}>
            <Checkbox label="Filter by starred" onChange={onStarredFilterChange} value={query.starred} />
          </div>
        )}
        {query.datasource && (
          <Button icon="times" variant="secondary" onClick={() => onDatasourceChange(undefined)}>
            Datasource: {query.datasource}
          </Button>
        )}
        <TagFilter isClearable tags={query.tag} tagOptions={getTagOptions} onChange={onTagFilterChange} />
      </HorizontalGroup>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    actionRow: css`
      display: none;

      @media only screen and (min-width: ${theme.v1.breakpoints.md}) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: ${theme.v1.spacing.lg} 0;
        width: 100%;
      }
    `,
    rowContainer: css`
      margin-right: ${theme.v1.spacing.md};
    `,
    checkboxWrapper: css`
      label {
        line-height: 1.2;
      }
    `,
  };
};
