import React, { useCallback, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { AsyncMultiSelect, Icon, resetSelectStyles, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { FolderInfo } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface FolderFilterProps {
  onChange: (folder: FolderInfo[]) => void;
  maxMenuHeight?: number;
}

export function FolderFilter({ onChange: propsOnChange, maxMenuHeight }: FolderFilterProps): JSX.Element {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(false);
  const getOptions = useCallback((searchString: string) => getFoldersAsOptions(searchString, setLoading), []);
  const debouncedLoadOptions = useMemo(() => debounce(getOptions, 300), [getOptions]);
  const [value, setValue] = useState<Array<SelectableValue<FolderInfo>>>([]);
  const onChange = useCallback(
    (folders: Array<SelectableValue<FolderInfo>>) => {
      const changedFolders = [];
      for (const folder of folders) {
        if (folder.value) {
          changedFolders.push(folder.value);
        }
      }
      propsOnChange(changedFolders);
      setValue(folders);
    },
    [propsOnChange]
  );
  const selectOptions = {
    defaultOptions: true,
    isMulti: true,
    noOptionsMessage: 'No folders found',
    placeholder: 'Filter by folder',
    styles: resetSelectStyles(),
    maxMenuHeight,
    value,
    onChange,
  };

  return (
    <div className={styles.container}>
      {value.length > 0 && (
        <span className={styles.clear} onClick={() => onChange([])}>
          Clear folders
        </span>
      )}
      <AsyncMultiSelect
        menuShouldPortal
        {...selectOptions}
        isLoading={loading}
        loadOptions={debouncedLoadOptions}
        prefix={<Icon name="filter" />}
        aria-label="Folder filter"
      />
    </div>
  );
}

async function getFoldersAsOptions(searchString: string, setLoading: (loading: boolean) => void) {
  setLoading(true);

  const params = {
    query: searchString,
    type: 'dash-folder',
    permission: 'View',
  };

  const searchHits = await getBackendSrv().search(params);
  const options = searchHits.map((d) => ({ label: d.title, value: { id: d.id, title: d.title } }));
  if (!searchString || 'general'.includes(searchString.toLowerCase())) {
    options.unshift({ label: 'General', value: { id: 0, title: 'General' } });
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
      text-decoration: underline;
      font-size: ${theme.spacing(1.5)};
      position: absolute;
      top: -${theme.spacing(2.75)};
      right: 0;
      cursor: pointer;
      color: ${theme.colors.text.link};

      &:hover {
        color: ${theme.colors.text.maxContrast};
      }
    `,
  };
}
