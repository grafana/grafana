import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ComboboxOption, FilterInput, MultiCombobox, Stack } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter, type TermCount } from 'app/core/components/TagFilter/TagFilter';

interface TemplateFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  getTagOptions: () => Promise<TermCount[]>;
  creatorOptions: Array<ComboboxOption<string>>;
  selectedCreators: string[];
  onCreatorsChange: (creators: Array<ComboboxOption<string>>) => void;
  sortValue: string | undefined;
  onSortChange: (change: SelectableValue) => void;
  getSortOptions: () => Promise<SelectableValue[]>;
}

export function TemplateFilters({
  searchQuery,
  onSearchChange,
  tags,
  onTagsChange,
  getTagOptions,
  creatorOptions,
  selectedCreators,
  onCreatorsChange,
  sortValue,
  onSortChange,
  getSortOptions,
}: TemplateFiltersProps) {
  return (
    <Stack direction="column" gap={1}>
      <FilterInput
        placeholder={t('dashboard-library.template-filters.search-placeholder', 'Search')}
        value={searchQuery}
        escapeRegex={false}
        onChange={onSearchChange}
      />
      <Stack direction="row" gap={1} wrap="wrap" justifyContent="space-between">
        <Stack direction="row" gap={1} alignItems="center">
          <TagFilter tags={tags} onChange={onTagsChange} tagOptions={getTagOptions} isClearable={false} width={30} />
          <MultiCombobox
            options={creatorOptions}
            value={selectedCreators}
            onChange={onCreatorsChange}
            placeholder={t('dashboard-library.template-filters.creator-placeholder', 'Filter by created by')}
            isClearable
            width={30}
          />
        </Stack>
        <SortPicker
          value={sortValue}
          onChange={onSortChange}
          getSortOptions={getSortOptions}
          placeholder={t('dashboard-library.template-filters.sort-placeholder', 'Sort')}
          isClearable
        />
      </Stack>
    </Stack>
  );
}
