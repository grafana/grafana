import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { AsyncMultiSelect, Icon, Button, useStyles2 } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service';
import { FolderInfo } from 'app/types';

export interface FolderFilterProps {
  onChange: (folder: FolderInfo[]) => void;
  maxMenuHeight?: number;
}

export function FolderFilter({ onChange, maxMenuHeight }: FolderFilterProps): JSX.Element {
  const styles = useStyles2(getStyles);
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
    <div className={styles.container}>
      {value.length > 0 && (
        <Button
          size="xs"
          icon="trash-alt"
          fill="text"
          className={styles.clear}
          onClick={() => onChange([])}
          aria-label="Clear folders"
        >
          Clear folders
        </Button>
      )}
      <AsyncMultiSelect
        value={value}
        onChange={onSelectOptionChange}
        isLoading={loading}
        loadOptions={debouncedLoadOptions}
        maxMenuHeight={maxMenuHeight}
        placeholder="Filter by folder"
        noOptionsMessage="No folders found"
        prefix={<Icon name="filter" />}
        aria-label="Folder filter"
        defaultOptions
      />
    </div>
  );
}

async function getFoldersAsOptions(
  searchString: string,
  setLoading: (loading: boolean) => void
): Promise<Array<SelectableValue<FolderInfo>>> {
  setLoading(true);

  const query = {
    kind: ['folder'],
    query: searchString,
    permission: 'View' as const,
  };
  const searchResults = await getGrafanaSearcher().search(query);

  const options = searchResults.view.map((item) => ({
    label: item.name,
    value: {
      uid: item.uid,
      title: item.name,
    },
  }));

  if (!searchString || 'general'.includes(searchString.toLowerCase())) {
    options.unshift({ label: 'General', value: { uid: 'general', title: 'General' } });
  }

  setLoading(false);

  return options;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      label: container;
      position: relative;
      min-width: 180px;
      flex-grow: 1;
    `,
    clear: css`
      label: clear;
      font-size: ${theme.spacing(1.5)};
      position: absolute;
      top: -${theme.spacing(4.5)};
      right: 0;
    `,
  };
}
