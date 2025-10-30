import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { ComboboxOption, MultiCombobox } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

export interface FolderFilterProps {
  onChange: (folder: string[]) => void;
}

export function FolderFilter({ onChange }: FolderFilterProps): JSX.Element {
  const [value, setValue] = useState<ComboboxOption[]>([]);
  const onSelectOptionChange = useCallback(
    (folders: ComboboxOption[]) => {
      const changedFolderIds = folders.filter((f) => Boolean(f.value)).map((f) => f.value!);
      onChange(changedFolderIds);
      setValue(folders);
    },
    [onChange]
  );

  return (
    <MultiCombobox
      prefixIcon="filter"
      minWidth={40}
      width="auto"
      options={getFoldersAsOptions}
      value={value}
      onChange={onSelectOptionChange}
      isClearable
      placeholder={t('folder-filter.select-placeholder', 'Filter by folder')}
      aria-label={t('folder-filter.select-aria-label', 'Folder filter')}
    />
  );
}

async function getFoldersAsOptions(searchString: string) {
  // Use searcher as it will handle the logic for using the appropriate API
  const searcher = getGrafanaSearcher();
  const queryResponse = await searcher.search({
    query: searchString,
    kind: ['folder'],
    limit: 100,
    permission: 'view',
  });

  const options = queryResponse.view.map((item) => ({
    label: item.name,
    value: item.uid,
  }));

  if (!searchString || 'dashboards'.includes(searchString.toLowerCase())) {
    options.unshift({ label: 'Dashboards', value: 'general' });
  }

  return options;
}
