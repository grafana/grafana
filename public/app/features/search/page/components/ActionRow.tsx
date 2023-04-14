import { css } from '@emotion/css';
import React, { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Checkbox, HorizontalGroup, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { t, Trans } from 'app/core/internationalization';

import { SearchLayout, SearchState } from '../../types';

function getLayoutOptions() {
  return [
    { value: SearchLayout.Folders, icon: 'folder', ariaLabel: t('search.actions.view-as-folders', 'View by folders') },
    { value: SearchLayout.List, icon: 'list-ul', ariaLabel: t('search.actions.view-as-list', 'View as list') },
  ];
}

interface Props {
  onLayoutChange: (layout: SearchLayout) => void;
  onSortChange: (value?: string) => void;
  onStarredFilterChange?: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: (tags: string[]) => void;
  getTagOptions: () => Promise<TermCount[]>;
  getSortOptions: () => Promise<SelectableValue[]>;
  sortPlaceholder?: string;
  onDatasourceChange: (ds?: string) => void;
  onPanelTypeChange: (pt?: string) => void;
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
    if (q.query || q.sort || q.starred || q.tag.length > 0) {
      return SearchLayout.List;
    }
  }

  return layout;
}

export const ActionRow = ({
  onLayoutChange,
  onSortChange,
  onStarredFilterChange = () => {},
  onTagFilterChange,
  getTagOptions,
  getSortOptions,
  sortPlaceholder,
  onDatasourceChange,
  onPanelTypeChange,
  onSetIncludePanels,
  state,
  showStarredFilter,
  hideLayout,
}: Props) => {
  const styles = useStyles2(getStyles);
  const layout = getValidQueryLayout(state);

  // Disabled folder layout option when query is present
  const disabledOptions = state.query || state.datasource || state.panel_type ? [SearchLayout.Folders] : [];

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
            label={t('search.actions.include-panels', 'Include panels')}
          />
        )}

        {showStarredFilter && (
          <div className={styles.checkboxWrapper}>
            <Checkbox
              label={t('search.actions.starred', 'Starred')}
              onChange={onStarredFilterChange}
              value={state.starred}
            />
          </div>
        )}
        {state.datasource && (
          <Button icon="times" variant="secondary" onClick={() => onDatasourceChange(undefined)}>
            <Trans i18nKey="search.actions.remove-datasource-filter">
              Datasource: {{ datasource: state.datasource }}
            </Trans>
          </Button>
        )}
        {state.panel_type && (
          <Button icon="times" variant="secondary" onClick={() => onPanelTypeChange(undefined)}>
            Panel: {state.panel_type}
          </Button>
        )}
      </HorizontalGroup>

      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          {!hideLayout && (
            <RadioButtonGroup
              options={getLayoutOptions()}
              disabledOptions={disabledOptions}
              onChange={onLayoutChange}
              value={layout}
            />
          )}
          <SortPicker
            onChange={(change) => onSortChange(change?.value)}
            value={state.sort}
            getSortOptions={getSortOptions}
            placeholder={sortPlaceholder || t('search.actions.sort-placeholder', 'Sort')}
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
