import debounce from 'debounce-promise';
import { useCallback, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AsyncMultiSelect, Icon } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { FolderInfo } from 'app/types/folders';

export interface FolderFilterProps {
  onChange: (folder: FolderInfo[]) => void;
  maxMenuHeight?: number;
}

export function FolderFilter({ onChange, maxMenuHeight }: FolderFilterProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const getOptions = useCallback((searchString: string) => getFoldersAsOptions(searchString, setLoading), []);
  const debouncedLoadOptions = useMemo(() => debounce(getOptions, 300), [getOptions]);

  const [value, setValue] = useState<Array<SelectableValue<FolderInfo>>>([]);
  const onSelectOptionChange = useCallback(
    (folders: Array<SelectableValue<FolderInfo>>) => {
      const changedFolderIds = folders.filter((f) => Boolean(f.value)).map((f) => f.value!);
      onChange(changedFolderIds);
      setValue(folders);
    },
    [onChange]
  );

  return (
    <AsyncMultiSelect
      value={value}
      onChange={onSelectOptionChange}
      isLoading={loading}
      loadOptions={debouncedLoadOptions}
      maxMenuHeight={maxMenuHeight}
      placeholder={t('folder-filter.select-placeholder', 'Filter by folder')}
      noOptionsMessage={t('folder-filter.noOptionsMessage-no-folders-found', 'No folders found')}
      prefix={<Icon name="filter" />}
      aria-label={t('folder-filter.select-aria-label', 'Folder filter')}
      defaultOptions
    />
  );
}

async function getFoldersAsOptions(
  searchString: string,
  setLoading: (loading: boolean) => void
): Promise<Array<SelectableValue<FolderInfo>>> {
  setLoading(true);
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
    value: { uid: item.uid, title: item.name },
  }));

  if (!searchString || 'dashboards'.includes(searchString.toLowerCase())) {
    options.unshift({ label: 'Dashboards', value: { uid: 'general', title: 'Dashboards' } });
  }

  setLoading(false);
  return options;
}
