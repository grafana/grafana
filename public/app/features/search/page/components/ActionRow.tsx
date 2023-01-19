import { css } from '@emotion/css';
import React, { FC, FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HorizontalGroup, RadioButtonGroup, useStyles2, Checkbox, Button } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';

import { SearchLayout, SearchState } from '../../types';

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
  getSortOptions: () => Promise<SelectableValue[]>;
  sortPlaceholder?: string;
  onDatasourceChange: (ds?: string) => void;
  includePanels: boolean;
  onSetIncludePanels: (v: boolean) => void;
  state: SearchState;
  showStarredFilter?: boolean;
  hideLayout?: boolean;
}

export function getValidQueryLayout(q: SearchState): SearchLayout {
  const layout = q.layout ?? SearchLayout.Folders;

  // Folders is not valid when a query exists
  if (layout === SearchLayout.Folders) {
    if (q.query || q.sort || q.starred) {
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
  getSortOptions,
  sortPlaceholder,
  onDatasourceChange,
  onSetIncludePanels,
  state,
  showStarredFilter,
  hideLayout,
}) => {
  const styles = useStyles2(getStyles);
  const layout = getValidQueryLayout(state);

  // Disabled folder layout option when query is present
  const disabledOptions = state.query ? [SearchLayout.Folders] : [];

  return (
    <div className={styles.actionRow}>
      <HorizontalGroup spacing="md" width="auto">
        <TagFilter isClearable={false} tags={state.tag} tagOptions={getTagOptions} onChange={onTagFilterChange} />
        {config.featureToggles.panelTitleSearch && (
          <Checkbox
            data-testid="include-panels"
            disabled={layout === SearchLayout.Folders}
            value={state.includePanels}
            onChange={() => onSetIncludePanels(!state.includePanels)}
            label="Include panels"
          />
        )}

        {showStarredFilter && (
          <div className={styles.checkboxWrapper}>
            <Checkbox label="Starred" onChange={onStarredFilterChange} value={state.starred} />
          </div>
        )}
        {state.datasource && (
          <Button icon="times" variant="secondary" onClick={() => onDatasourceChange(undefined)}>
            Datasource: {state.datasource}
          </Button>
        )}
      </HorizontalGroup>
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
          <SortPicker
            onChange={onSortChange}
            value={state.sort?.value}
            getSortOptions={getSortOptions}
            placeholder={sortPlaceholder}
            isClearable
          />
        </HorizontalGroup>
      </div>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    actionRow: css`
      display: none;

      ${theme.breakpoints.up('md')} {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: ${theme.spacing(2)};
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
