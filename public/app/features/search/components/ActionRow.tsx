import React, { FC, ChangeEvent, FormEvent } from 'react';
import { css } from '@emotion/css';
import { HorizontalGroup, RadioButtonGroup, stylesFactory, useTheme, Checkbox, InlineSwitch } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
import { DashboardQuery, SearchLayout } from '../types';
import { config } from '@grafana/runtime';

export const layoutOptions = [
  { value: SearchLayout.Folders, icon: 'folder', ariaLabel: 'View by folders' },
  { value: SearchLayout.List, icon: 'list-ul', ariaLabel: 'View as list' },
];

const searchSrv = new SearchSrv();

interface Props {
  onLayoutChange: (layout: SearchLayout) => void;
  setShowPreviews: (newValue: boolean) => void;
  onSortChange: (value: SelectableValue) => void;
  onStarredFilterChange?: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: (tags: string[]) => void;
  query: DashboardQuery;
  showStarredFilter?: boolean;
  hideLayout?: boolean;
  showPreviews?: boolean;
}

export const ActionRow: FC<Props> = ({
  onLayoutChange,
  setShowPreviews,
  onSortChange,
  onStarredFilterChange = () => {},
  onTagFilterChange,
  query,
  showStarredFilter,
  hideLayout,
  showPreviews,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const previewsEnabled = config.featureToggles.dashboardPreviews;

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          {!hideLayout ? (
            <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={query.layout} />
          ) : null}
          <SortPicker onChange={onSortChange} value={query.sort?.value} />
          {previewsEnabled && (
            <InlineSwitch
              id="search-show-previews"
              label="Show previews"
              showLabel
              value={showPreviews}
              onChange={(ev: ChangeEvent<HTMLInputElement>) => setShowPreviews(ev.target.checked)}
              transparent
            />
          )}
        </HorizontalGroup>
      </div>
      <HorizontalGroup spacing="md" width="auto">
        {showStarredFilter && (
          <div className={styles.checkboxWrapper}>
            <Checkbox label="Filter by starred" onChange={onStarredFilterChange} value={query.starred} />
          </div>
        )}
        <TagFilter isClearable tags={query.tag} tagOptions={searchSrv.getDashboardTags} onChange={onTagFilterChange} />
      </HorizontalGroup>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css`
      display: none;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: ${theme.spacing.lg} 0;
        width: 100%;
      }
    `,
    rowContainer: css`
      margin-right: ${theme.spacing.md};
    `,
    checkboxWrapper: css`
      label {
        line-height: 1.2;
      }
    `,
  };
});
