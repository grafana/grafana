import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import { useAsync } from 'react-use';

import { AppEvents, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2, ActionMeta, Input, InputActionMeta, AsyncVirtualizedSelect } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderByUid, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from 'app/features/search/types';
import { AccessControlAction, PermissionLevelString } from 'app/types';

export type FolderPickerFilter = (hits: DashboardSearchHit[]) => DashboardSearchHit[];

export const ADD_NEW_FOLER_OPTION = '+ Add new';

export interface FolderWarning {
  warningCondition: (value: string) => boolean;
  warningComponent: () => JSX.Element;
}

export interface CustomAdd {
  disallowValues: boolean;
  isAllowedValue?: (value: string) => boolean;
}

export interface Props {
  onChange: ($folder: { title: string; uid: string }) => void;
  enableCreateNew?: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: number | string;
  initialTitle?: string;
  initialFolderUid?: string;
  permissionLevel?: Exclude<PermissionLevelString, PermissionLevelString.Admin>;
  filter?: FolderPickerFilter;
  allowEmpty?: boolean;
  showRoot?: boolean;
  onClear?: () => void;
  accessControlMetadata?: boolean;
  customAdd?: CustomAdd;
  folderWarning?: FolderWarning;

  /**
   * Skips loading all folders in order to find the folder matching
   * the folder where the dashboard is stored.
   * Instead initialFolderUid and initialTitle will be used to display the correct folder.
   * initialFolderUid needs to be a string or an error will be thrown.
   */
  skipInitialLoad?: boolean;
  /** The id of the search input. Use this to set a matching label with htmlFor */
  inputId?: string;
}
export type SelectedFolder = SelectableValue<string>;
const VALUE_FOR_ADD = '-10';

export function FolderPicker(props: Props) {
  const {
    dashboardId,
    allowEmpty,
    onChange,
    filter,
    enableCreateNew,
    inputId,
    onClear,
    enableReset,
    initialFolderUid,
    initialTitle = '',
    permissionLevel = PermissionLevelString.Edit,
    rootName = 'General',
    showRoot = true,
    skipInitialLoad,
    accessControlMetadata,
    customAdd,
    folderWarning,
  } = props;

  const [folder, setFolder] = useState<SelectedFolder | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [newFolderValue, setNewFolderValue] = useState(folder?.title ?? '');

  const styles = useStyles2(getStyles);

  const isClearable = typeof onClear === 'function';

  const getOptions = useCallback(
    async (query: string) => {
      const searchHits = await searchFolders(query, permissionLevel, accessControlMetadata);
      const resultsAfterMapAndFilter = mapSearchHitsToOptions(searchHits, filter);
      const options: Array<SelectableValue<string>> = resultsAfterMapAndFilter;

      const hasAccess =
        contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor) ||
        contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor);

      if (hasAccess && rootName?.toLowerCase().startsWith(query.toLowerCase()) && showRoot) {
        options.unshift({ label: rootName, value: '' });
      }

      if (
        enableReset &&
        query === '' &&
        initialTitle !== '' &&
        !options.find((option) => option.label === initialTitle)
      ) {
        options.unshift({ label: initialTitle, value: initialFolderUid });
      }
      if (enableCreateNew && Boolean(customAdd)) {
        return [...options, { value: VALUE_FOR_ADD, label: ADD_NEW_FOLER_OPTION, title: query }];
      } else {
        return options;
      }
    },
    [
      enableReset,
      initialFolderUid,
      initialTitle,
      permissionLevel,
      rootName,
      showRoot,
      accessControlMetadata,
      filter,
      enableCreateNew,
      customAdd,
    ]
  );

  const debouncedSearch = useMemo(() => {
    return debounce(getOptions, 300, { leading: true });
  }, [getOptions]);

  const loadInitialValue = async () => {
    const resetFolder: SelectableValue<string> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<string> = { label: rootName, value: '' };

    const options = await getOptions('');

    let folder: SelectableValue<string> | null = null;

    if (initialFolderUid !== undefined && initialFolderUid !== null) {
      folder = options.find((option) => option.value === initialFolderUid) || null;
    } else if (enableReset && initialTitle) {
      folder = resetFolder;
    } else if (initialFolderUid) {
      folder = options.find((option) => option.id === initialFolderUid) || null;
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
    !isCreatingNew && setFolder(folder);
  };

  useEffect(() => {
    // if this is not the same as our initial value notify parent
    if (folder && folder.value !== initialFolderUid) {
      !isCreatingNew && folder.value && folder.label && onChange({ uid: folder.value, title: folder.label });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, initialFolderUid]);

  // initial values for dropdown
  useAsync(async () => {
    if (skipInitialLoad) {
      const folder = await getInitialValues({
        getFolder: getFolderByUid,
        folderUid: initialFolderUid,
        folderName: initialTitle,
      });
      setFolder(folder);
    }

    await loadInitialValue();
  }, [skipInitialLoad, initialFolderUid, initialTitle]);

  useEffect(() => {
    if (folder && folder.id === VALUE_FOR_ADD) {
      setIsCreatingNew(true);
    }
  }, [folder]);

  const onFolderChange = useCallback(
    (newFolder: SelectableValue<string> | null | undefined, actionMeta: ActionMeta) => {
      if (newFolder?.value === VALUE_FOR_ADD) {
        setFolder({
          id: VALUE_FOR_ADD,
          title: inputValue,
        });
        setNewFolderValue(inputValue);
      } else {
        if (!newFolder) {
          newFolder = { value: '', label: rootName };
        }

        if (actionMeta.action === 'clear' && onClear) {
          onClear();
          return;
        }

        setFolder(newFolder);
        onChange({ uid: newFolder.value!, title: newFolder.label! });
      }
    },
    [onChange, onClear, rootName, inputValue]
  );

  const createNewFolder = useCallback(
    async (folderName: string) => {
      if (folderWarning?.warningCondition(folderName)) {
        return false;
      }
      const newFolder = await createFolder({ title: folderName });
      let folder: SelectableValue<string> = { value: '', label: 'Not created' };

      if (newFolder.uid) {
        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
        folder = { value: newFolder.uid, label: newFolder.title };

        setFolder(newFolder);
        onFolderChange(folder, { action: 'create-option', option: folder });
      } else {
        appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
      }

      return folder;
    },
    [folderWarning, onFolderChange]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const dissalowValues = Boolean(customAdd?.disallowValues);
      if (event.key === 'Enter' && dissalowValues && !customAdd?.isAllowedValue!(newFolderValue)) {
        event.preventDefault();
        return;
      }

      switch (event.key) {
        case 'Enter': {
          createNewFolder(folder?.title!);
          setIsCreatingNew(false);
          break;
        }
        case 'Escape': {
          setFolder({ value: '', label: rootName });
          setIsCreatingNew(false);
        }
      }
    },
    [customAdd?.disallowValues, customAdd?.isAllowedValue, newFolderValue, createNewFolder, folder?.title, rootName]
  );

  const onNewFolderChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setNewFolderValue(value);
    setFolder({ id: undefined, title: value });
  };

  const onBlur = () => {
    setFolder({ value: '', label: rootName });
    setIsCreatingNew(false);
  };

  const onInputChange = (value: string, { action }: InputActionMeta) => {
    if (action === 'input-change') {
      setInputValue((ant) => value);
    }

    if (action === 'menu-close') {
      setInputValue((_) => value);
    }
    return;
  };

  const FolderWarningWhenCreating = () => {
    if (folderWarning?.warningCondition(newFolderValue)) {
      return <folderWarning.warningComponent />;
    } else {
      return null;
    }
  };

  const FolderWarningWhenSearching = () => {
    if (folderWarning?.warningCondition(inputValue)) {
      return <folderWarning.warningComponent />;
    } else {
      return null;
    }
  };

  if (isCreatingNew) {
    return (
      <>
        <FolderWarningWhenCreating />
        <div className={styles.newFolder}>Press enter to create the new folder.</div>
        <Input
          aria-label={'aria-label'}
          width={30}
          autoFocus={true}
          value={newFolderValue}
          onChange={onNewFolderChange}
          onKeyDown={onKeyDown}
          placeholder="Press enter to confirm new folder."
          onBlur={onBlur}
        />
      </>
    );
  } else {
    return (
      <div data-testid={selectors.components.FolderPicker.containerV2}>
        <FolderWarningWhenSearching />
        <AsyncVirtualizedSelect
          inputId={inputId}
          aria-label={selectors.components.FolderPicker.input}
          loadingMessage={t('folder-picker.loading', 'Loading folders...')}
          defaultOptions
          defaultValue={folder}
          inputValue={inputValue}
          onInputChange={onInputChange}
          value={folder}
          allowCustomValue={enableCreateNew && !Boolean(customAdd)}
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
  return filteredHits.map((hit) => ({ label: hit.title, value: hit.uid }));
}
interface Args {
  getFolder: typeof getFolderByUid;
  folderUid?: string;
  folderName?: string;
}

export async function getInitialValues({ folderName, folderUid, getFolder }: Args): Promise<SelectableValue<string>> {
  if (folderUid === null || folderUid === undefined) {
    throw new Error('folderUid is not found.');
  }

  if (folderName) {
    return { label: folderName, value: folderUid };
  }

  const folderDto = await getFolder(folderUid);
  return { label: folderDto.title, value: folderUid };
}

const getStyles = (theme: GrafanaTheme2) => ({
  newFolder: css`
    color: ${theme.colors.warning.main};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding-bottom: ${theme.spacing(1)};
  `,
});
