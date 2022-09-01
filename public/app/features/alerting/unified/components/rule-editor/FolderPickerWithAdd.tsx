import { t } from '@lingui/macro';
import { debounce } from 'lodash';
import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import { useAsync } from 'react-use';

import { AppEvents, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ActionMeta, AsyncSelect, Input } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { getInitialValues } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderById, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from 'app/features/search/types';
import { AccessControlAction, PermissionLevelString } from 'app/types';

export type FolderPickerFilter = (hits: DashboardSearchHit[]) => DashboardSearchHit[];

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  enableCreateNew?: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: number | string;
  initialTitle?: string;
  initialFolderId?: number;
  permissionLevel?: Exclude<PermissionLevelString, PermissionLevelString.Admin>;
  filter?: FolderPickerFilter;
  allowEmpty?: boolean;
  showRoot?: boolean;
  onClear?: () => void;
  accessControlMetadata?: boolean;
  /**
   * Skips loading all folders in order to find the folder matching
   * the folder where the dashboard is stored.
   * Instead initialFolderId and initialTitle will be used to display the correct folder.
   * initialFolderId needs to have an value > -1 or an error will be thrown.
   */
  skipInitialLoad?: boolean;
  /** The id of the search input. Use this to set a matching label with htmlFor */
  inputId?: string;
}
export type SelectedFolder = SelectableValue<number>;
const VALUE_FOR_ADD = -10;

export function FolderPickerWithAdd(props: Props) {
  const {
    dashboardId,
    allowEmpty,
    onChange,
    filter,
    enableCreateNew,
    inputId,
    onClear,
    enableReset,
    initialFolderId,
    initialTitle,
    permissionLevel,
    rootName,
    showRoot,
    skipInitialLoad,
    accessControlMetadata,
  } = props;
  const isClearable = typeof onClear === 'function';
  const [folder, setFolder] = useState<SelectedFolder | null>(null);
  const [isCustom, setIsCustom] = useState(false);

  const getOptions = useCallback(
    async (query: string) => {
      const searchHits = await searchFolders(query, permissionLevel, accessControlMetadata);
      const options: Array<SelectableValue<number>> = mapSearchHitsToOptions(searchHits, filter);

      const hasAccess =
        contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor) ||
        contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor);

      if (hasAccess && rootName?.toLowerCase().startsWith(query.toLowerCase()) && showRoot) {
        options.unshift({ label: rootName, value: 0 });
      }

      if (
        enableReset &&
        query === '' &&
        initialTitle !== '' &&
        !options.find((option) => option.label === initialTitle)
      ) {
        options.unshift({ label: initialTitle, value: initialFolderId });
      }
      if (enableCreateNew) {
        return [...options, { value: VALUE_FOR_ADD, label: '+ Add new', title: query }];
      } else {
        return options;
      }
    },
    [
      enableReset,
      initialFolderId,
      initialTitle,
      permissionLevel,
      rootName,
      showRoot,
      accessControlMetadata,
      filter,
      enableCreateNew,
    ]
  );

  const debouncedSearch = useMemo(() => {
    return debounce(getOptions, 300, { leading: true });
  }, [getOptions]);

  const loadInitialValue = async () => {
    const resetFolder: SelectableValue<number> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<number> = { label: rootName, value: 0 };

    const options = await getOptions('');

    let folder: SelectableValue<number> | null = null;

    if (initialFolderId !== undefined && initialFolderId !== null && initialFolderId > -1) {
      folder = options.find((option) => option.value === initialFolderId) || null;
    } else if (enableReset && initialTitle) {
      folder = resetFolder;
    } else if (initialFolderId) {
      folder = options.find((option) => option.id === initialFolderId) || null;
    }

    if (!folder && !allowEmpty) {
      if (contextSrv.isEditor) {
        folder = rootFolder;
      } else {
        // We shouldn't assign a random folder without the user actively choosing it on a persisted dashboard
        const isPersistedDashBoard = !!dashboardId;
        if (isPersistedDashBoard) {
          folder = resetFolder;
        } else {
          folder = options.length > 0 ? options[0] : resetFolder;
        }
      }
    }
    !isCustom && setFolder(folder);
  };

  useEffect(() => {
    // if this is not the same as our initial value notify parent
    if (folder && folder.value !== initialFolderId) {
      onChange({ id: folder.value!, title: folder.label! });
    }
  }, [folder, initialFolderId, onChange]);

  // initial values for dropdown
  useAsync(async () => {
    if (skipInitialLoad) {
      const folder = await getInitialValues({
        getFolder: getFolderById,
        folderId: initialFolderId,
        folderName: initialTitle,
      });
      setFolder(folder);
    }

    await loadInitialValue();
  }, [skipInitialLoad, initialFolderId, initialTitle]);

  useEffect(() => {
    if (folder && folder.id === VALUE_FOR_ADD) {
      setIsCustom(true);
    }
  }, [folder]);

  const onFolderChange = useCallback(
    (newFolder: SelectableValue<number>, actionMeta: ActionMeta) => {
      const value = newFolder.value;
      if (value === VALUE_FOR_ADD) {
        setFolder({ id: VALUE_FOR_ADD, title: newFolder?.title?.split('/').join('') || '' }); //slashes not allowed
      } else {
        if (!newFolder) {
          newFolder = { value: 0, label: rootName };
        }

        if (actionMeta.action === 'clear' && onClear) {
          onClear();
          return;
        }

        setFolder(newFolder);
        onChange({ id: newFolder.value!, title: newFolder.label! });
      }
    },
    [onChange, onClear, rootName]
  );

  const createNewFolder = useCallback(
    async (folderName: string) => {
      const newFolder = await createFolder({ title: folderName });
      let folder: SelectableValue<number> = { value: -1, label: 'Not created' };

      if (newFolder.id > -1) {
        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
        folder = { value: newFolder.id, label: newFolder.title };

        setFolder(newFolder);
        onFolderChange(folder, { action: 'create-option', option: folder });
      } else {
        appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
      }

      return folder;
    },
    [onFolderChange]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'Enter': {
          createNewFolder(folder?.title!);
          setIsCustom(false);
          break;
        }
        case 'Escape': {
          setFolder({ value: 0, label: rootName });
          setIsCustom(false);
        }
      }
    },
    [createNewFolder, folder, rootName]
  );

  const onNewFolderChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    const withoutSlashes = value.split('/').join('');
    setFolder({ id: -1, title: withoutSlashes });
  };

  if (isCustom) {
    return (
      <Input
        aria-label={'aria-label'}
        width={30}
        autoFocus={true}
        value={folder?.title || ''}
        onChange={onNewFolderChange}
        onKeyDown={onKeyDown}
        placeholder="Press enter to confirm new folder"
      />
    );
  } else {
    return (
      <div data-testid={selectors.components.FolderPicker.containerV2}>
        <AsyncSelect
          inputId={inputId}
          aria-label={selectors.components.FolderPicker.input}
          loadingMessage={t({ id: 'folder-picker.loading', message: 'Loading folders...' })}
          defaultOptions
          defaultValue={folder}
          value={folder}
          allowCustomValue={false}
          loadOptions={debouncedSearch}
          onChange={onFolderChange}
          onCreateOption={createNewFolder}
          isClearable={isClearable}
        />
      </div>
    );
  }
}

function mapSearchHitsToOptions(hits: DashboardSearchHit[], filter?: FolderPickerFilter) {
  const filteredHits = filter ? filter(hits) : hits;
  return filteredHits.map((hit) => ({ label: hit.title, value: hit.id }));
}
