import { css } from '@emotion/css';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ComboboxOption, FilterInput, MultiCombobox, Stack, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, type TermCount } from 'app/core/components/TagFilter/TagFilter';

interface SearchAndSortProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortValue: string | undefined;
  onSortChange: (change: SelectableValue) => void;
  getSortOptions: () => Promise<SelectableValue[]>;
}

/** With tag and creator filters, for lists whose templates carry tags and creators. */
interface AllFiltersProps extends SearchAndSortProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  getTagOptions: () => Promise<TermCount[]>;
  creatorOptions: Array<ComboboxOption<string>>;
  selectedCreators: string[];
  onCreatorsChange: (creators: Array<ComboboxOption<string>>) => void;
}

/** Without the tag and creator filters, the search and the sort share one row. */
export function TemplateFilters(props: SearchAndSortProps | AllFiltersProps) {
  const { searchQuery, onSearchChange, sortValue, onSortChange, getSortOptions } = props;
  const styles = useStyles2(getStyles);
  const hasAllFilters = 'onTagsChange' in props;
  const search = (
    <FilterInput
      className={hasAllFilters ? undefined : styles.rowSearch}
      placeholder={t('dashboard-library.custom-dashboard-template-filters.search-placeholder', 'Search')}
      value={searchQuery}
      escapeRegex={false}
      onChange={onSearchChange}
    />
  );
  const sort = (
    <SortPicker
      value={sortValue}
      onChange={onSortChange}
      getSortOptions={getSortOptions}
      placeholder={t('dashboard-library.custom-dashboard-template-filters.sort-placeholder', 'Sort')}
      isClearable
      // In one row it is as wide as its value, so the search keeps the room.
      width={hasAllFilters ? 30 : 'auto'}
    />
  );

  if (!hasAllFilters) {
    return (
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        {search}
        {sort}
      </Stack>
    );
  }

  const { tags, onTagsChange, getTagOptions, creatorOptions, selectedCreators, onCreatorsChange } = props;
  return (
    <Stack direction="column" gap={1}>
      {search}
      <Stack direction="row" gap={1} wrap="wrap" justifyContent="space-between">
        <Stack direction="row" gap={1} alignItems="center">
          <TagFilter tags={tags} onChange={onTagsChange} tagOptions={getTagOptions} isClearable={false} width={30} />
          <MultiCombobox
            options={creatorOptions}
            value={selectedCreators}
            onChange={onCreatorsChange}
            placeholder={t(
              'dashboard-library.custom-dashboard-template-filters.creator-placeholder',
              'Filter by created by'
            )}
            isClearable
            width={30}
          />
        </Stack>
        {sort}
      </Stack>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // The search takes the room the sort leaves, up to a cap, and gives it up first.
    rowSearch: css({
      flex: 1,
      minWidth: 0,
      maxWidth: theme.spacing(32),
    }),
  };
}
