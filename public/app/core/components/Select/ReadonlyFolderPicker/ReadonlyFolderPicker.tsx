import debouncePromise from 'debounce-promise';
import React, { ReactElement, useCallback, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AsyncSelect } from '@grafana/ui';

import { GENERAL_FOLDER_ID, GENERAL_FOLDER_TITLE } from '../../../../features/search/constants';
import { FolderInfo, PermissionLevelString } from '../../../../types';

import { findOptionWithId, getFolderAsOption, getFoldersAsOptions } from './api';
import { PermissionLevel } from './types';

export const ALL_FOLDER: FolderInfo = { id: undefined, title: 'All' };
export const GENERAL_FOLDER: FolderInfo = { id: GENERAL_FOLDER_ID, title: GENERAL_FOLDER_TITLE };

export interface ReadonlyFolderPickerProps {
  onChange: (folder?: FolderInfo) => void;
  initialFolderId?: number;
  /**
   * By default the folders API doesn't include the General folder because it doesn't exist
   * Add any extra folders you need to appear in the folder picker with the extraFolders property
   */
  extraFolders?: FolderInfo[];
  permissionLevel?: PermissionLevel;
}

export function ReadonlyFolderPicker({
  onChange: propsOnChange,
  extraFolders = [],
  initialFolderId,
  permissionLevel = PermissionLevelString.View,
}: ReadonlyFolderPickerProps): ReactElement {
  const [initialized, setInitialized] = useState(false);
  const [option, setOption] = useState<SelectableValue<FolderInfo> | undefined>(undefined);
  const [options, setOptions] = useState<Array<SelectableValue<FolderInfo>> | undefined>(undefined);
  const initialize = useCallback(
    async (options: Array<SelectableValue<FolderInfo>>) => {
      let option = findOptionWithId(options, initialFolderId);
      if (!option) {
        // we didn't find the option with the initialFolderId
        // might be because the folder doesn't exist any longer
        // might be because the folder is outside of the search limit of the api
        option = (await getFolderAsOption(initialFolderId)) ?? options[0]; // get folder by id or select the first item in the options and call propsOnChange
        propsOnChange(option.value);
      }

      setInitialized(true);
      setOptions(options);
      setOption(option);
    },
    [initialFolderId, propsOnChange]
  );
  const loadOptions = useCallback(
    async (query: string) => {
      const options = await getFoldersAsOptions({ query, permissionLevel, extraFolders });
      if (!initialized) {
        await initialize(options);
      }
      return options;
    },
    [permissionLevel, extraFolders, initialized, initialize]
  );
  const debouncedLoadOptions = debouncePromise(loadOptions, 300, { leading: true });
  const onChange = useCallback(
    ({ value }: SelectableValue<FolderInfo>) => {
      const option = findOptionWithId(options, value?.id);
      setOption(option);
      propsOnChange(value);
    },
    [options, propsOnChange]
  );

  return (
    <div data-testid={selectors.components.ReadonlyFolderPicker.container}>
      <AsyncSelect
        loadingMessage="Loading folders..."
        defaultOptions
        defaultValue={option}
        value={option}
        loadOptions={debouncedLoadOptions}
        onChange={onChange}
      />
    </div>
  );
}
