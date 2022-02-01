import React, { FC, useCallback, useState } from 'react';
import { AppEvents, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AsyncSelect, Button, InlineField, InlineFieldRow, Input, useTheme2 } from '@grafana/ui';
import { useAsync, useAsyncFn } from 'react-use';
import debounce from 'debounce-promise';

import appEvents from '../../app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderById, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { PermissionLevelString } from '../../../types';
import { MenuListProps } from 'react-select';
import { SelectMenu } from '@grafana/ui/src/components/Select/SelectMenu';
import { css } from '@emotion/css';

type SelectedFolder = SelectableValue<number>;

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  enableCreateNew?: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: any;
  initialTitle?: string;
  initialFolderId?: number;
  permissionLevel?: Exclude<PermissionLevelString, PermissionLevelString.Admin>;
  allowEmpty?: boolean;
  showRoot?: boolean;
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

const FolderPicker: FC<Props> = ({
  inputId,
  dashboardId,
  enableCreateNew = false,
  skipInitialLoad,
  initialFolderId,
  initialTitle = '',
  rootName = 'General',
  enableReset = false,
  permissionLevel = PermissionLevelString.Edit,
  allowEmpty = false,
  showRoot = true,
  onChange,
}) => {
  const [folder, setFolder] = useState<SelectedFolder | null>(null);

  const onFolderChange = useCallback(
    (newFolder: SelectedFolder) => {
      setFolder(newFolder);
      onChange({ id: newFolder.value ?? 0, title: newFolder.label ?? rootName });
    },
    [onChange, rootName]
  );

  const getOptions = useCallback(
    async (query: string) => {
      const searchHits = await searchFolders(query, permissionLevel);

      const options: SelectedFolder[] = searchHits.map((hit) => ({ label: hit.title, value: hit.id }));
      if (contextSrv.isEditor && rootName?.toLowerCase().startsWith(query.toLowerCase()) && showRoot) {
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

      return options;
    },
    [enableReset, initialFolderId, initialTitle, permissionLevel, rootName, showRoot]
  );

  const debouncedSearch = debounce(getOptions, 300, { leading: true });

  const loadInitialValue = useCallback(async () => {
    const resetFolder: SelectedFolder = { label: initialTitle, value: undefined };
    const rootFolder: SelectedFolder = { label: rootName, value: 0 };

    const options = await getOptions('');

    let folder: SelectedFolder | null = null;

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

    setFolder(folder);
    // if this is not the same as our initial value notify parent
    if (folder && folder.value !== initialFolderId) {
      onChange({ id: folder.value ?? 0, title: folder.label ?? rootName });
    }
  }, [allowEmpty, dashboardId, enableReset, getOptions, initialFolderId, initialTitle, onChange, rootName]);

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

  return (
    <div data-testid={selectors.components.FolderPicker.containerV2}>
      <AsyncSelect
        inputId={inputId}
        aria-label={selectors.components.FolderPicker.input}
        loadingMessage="Loading folders..."
        defaultOptions
        defaultValue={folder}
        value={folder}
        loadOptions={debouncedSearch}
        onChange={onFolderChange}
        components={enableCreateNew && { MenuList: SelectMenuWithCreate }}
        menuShouldPortal
        backspaceRemovesValue={false}
        isClearable={false}
        tabSelectsValue={false}
      />
    </div>
  );
};

export { FolderPicker };

const SelectMenuWithCreate = (props: MenuListProps<SelectedFolder, false>) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [editMode, setEditMode] = useState<boolean>(false);

  const toggleEditMode = useCallback(() => {
    setEditMode((mode) => !mode);
  }, []);

  const [{ loading }, handleCreateFolder] = useAsyncFn(
    async (title: string) => {
      const newFolder = await createFolder({ title });
      let folder = { value: -1, label: 'Not created' };

      if (newFolder.id > -1) {
        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
        folder = { value: newFolder.id, label: newFolder.title };
        onFolderChange(folder); // TODO hook up this function
      } else {
        appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
      }

      return folder;

      toggleEditMode();
    },
    [toggleEditMode]
  );

  return (
    <SelectMenu {...props}>
      {props.children}
      <div className={styles.menuFooter}>
        {!editMode && (
          <Button icon="folder-plus" type="button" size="sm" onClick={toggleEditMode} className={styles.createButton}>
            New folder
          </Button>
        )}
        {/* {editMode && (
          <InlineFieldRow>
            <InlineField>
              <Input name="folder-name" placeholder="Folder name" />
            </InlineField>
            <InlineField>
              <Button disabled={loading} size="sm" type="button" onClick={() => handleCreateFolder('test')}>
                Create folder
              </Button>
            </InlineField>
          </InlineFieldRow>
        )} */}
      </div>
    </SelectMenu>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  menuFooter: css`
    padding: ${theme.v1.spacing.sm};
    background: ${theme.v1.colors.bg1};
    border-top: solid 1px ${theme.v1.colors.border2};
    display: flex;
    flex-direction: column;
  `,
  createButton: css`
    align-self: flex-end;
  `,
});

interface Args {
  getFolder: typeof getFolderById;
  folderId?: number;
  folderName?: string;
}

export async function getInitialValues({ folderName, folderId, getFolder }: Args): Promise<SelectedFolder> {
  if (folderId === null || folderId === undefined || folderId < 0) {
    throw new Error('folderId should to be greater or equal to zero.');
  }

  if (folderName) {
    return { label: folderName, value: folderId };
  }

  const folderDto = await getFolder(folderId);
  return { label: folderDto.title, value: folderId };
}
