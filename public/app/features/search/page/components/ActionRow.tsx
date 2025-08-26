import { css } from '@emotion/css';
import { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Checkbox, Stack, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';

import { SearchLayout, SearchState } from '../../types';

function getLayoutOptions() {
  return [
    {
      value: SearchLayout.Folders,
      icon: 'folder',
      description: t('search.actions.view-as-folders', 'View by folders'),
    },
    { value: SearchLayout.List, icon: 'list-ul', description: t('search.actions.view-as-list', 'View as list') },
  ];
}

interface ActionRowProps {
  state: SearchState;
  showStarredFilter?: boolean;
  showLayout?: boolean;
  sortPlaceholder?: string;

  onLayoutChange: (layout: SearchLayout) => void;
  onSortChange: (value?: string) => void;
  onStarredFilterChange?: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: (tags: string[]) => void;
  getTagOptions: () => Promise<TermCount[]>;
  getSortOptions: () => Promise<SelectableValue[]>;
  onDatasourceChange: (ds?: string) => void;
  onPanelTypeChange: (pt?: string) => void;
  onSetIncludePanels: (v: boolean) => void;
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
  state,
  showStarredFilter,
  showLayout,
  sortPlaceholder,
  onLayoutChange,
  onSortChange,
  onStarredFilterChange = () => {},
  onTagFilterChange,
  getTagOptions,
  getSortOptions,
  onDatasourceChange,
  onPanelTypeChange,
  onSetIncludePanels,
}: ActionRowProps) => {
  const styles = useStyles2(getStyles);

  const layout = getValidQueryLayout(state);

  // Disabled folder layout option when query is present
  const disabledOptions =
    state.tag.length || state.starred || state.query || state.datasource || state.panel_type
      ? [SearchLayout.Folders]
      : [];

  return (
    <Stack justifyContent="space-between" alignItems="center">
      <Stack gap={2} alignItems="center">
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
            <Trans i18nKey="search.action-row.panel-type" values={{ panel: state.panel_type }}>
              Panel: {'{{panel}}'}
            </Trans>
          </Button>
        )}
      </Stack>

      <Stack gap={2}>
        {showLayout && (
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
      </Stack>
    </Stack>
  );
};

ActionRow.displayName = 'ActionRow';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    checkboxWrapper: css({
      label: {
        lineHeight: '1.2',
      },
    }),
  };
};
