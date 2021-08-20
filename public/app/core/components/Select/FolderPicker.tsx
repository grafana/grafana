import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { AppEvents, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import appEvents from '../../app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderById, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { PermissionLevelString } from '../../../types';

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
}

interface State {
  folder: SelectableValue<number> | null;
}

export class FolderPicker extends PureComponent<Props, State> {
  debouncedSearch: any;

  constructor(props: Props) {
    super(props);

    this.state = {
      folder: null,
    };

    this.debouncedSearch = debounce(this.getOptions, 300, {
      leading: true,
      trailing: true,
    });
  }

  static defaultProps: Partial<Props> = {
    rootName: 'General',
    enableReset: false,
    initialTitle: '',
    enableCreateNew: false,
    permissionLevel: PermissionLevelString.Edit,
    allowEmpty: false,
    showRoot: true,
  };

  componentDidMount = async () => {
    if (this.props.skipInitialLoad) {
      const folder = await getInitialValues({
        getFolder: getFolderById,
        folderId: this.props.initialFolderId,
        folderName: this.props.initialTitle,
      });
      this.setState({ folder });
      return;
    }

    await this.loadInitialValue();
  };

  getOptions = async (query: string) => {
    const { rootName, enableReset, initialTitle, permissionLevel, initialFolderId, showRoot } = this.props;

    const searchHits = await searchFolders(query, permissionLevel);

    const options: Array<SelectableValue<number>> = searchHits.map((hit) => ({ label: hit.title, value: hit.id }));
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
  };

  onFolderChange = (newFolder: SelectableValue<number>) => {
    if (!newFolder) {
      newFolder = { value: 0, label: this.props.rootName };
    }

    this.setState(
      {
        folder: newFolder,
      },
      () => this.props.onChange({ id: newFolder.value!, title: newFolder.label! })
    );
  };

  createNewFolder = async (folderName: string) => {
    // @ts-ignore
    const newFolder = await createFolder({ title: folderName });
    let folder = { value: -1, label: 'Not created' };
    if (newFolder.id > -1) {
      appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
      folder = { value: newFolder.id, label: newFolder.title };
      await this.onFolderChange(folder);
    } else {
      appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
    }

    return folder;
  };

  private loadInitialValue = async () => {
    const { initialTitle, rootName, initialFolderId, enableReset, dashboardId } = this.props;
    const resetFolder: SelectableValue<number> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<number> = { label: rootName, value: 0 };

    const options = await this.getOptions('');

    let folder: SelectableValue<number> | null = null;

    if (initialFolderId !== undefined && initialFolderId !== null && initialFolderId > -1) {
      folder = options.find((option) => option.value === initialFolderId) || null;
    } else if (enableReset && initialTitle) {
      folder = resetFolder;
    } else if (initialFolderId) {
      folder = options.find((option) => option.id === initialFolderId) || null;
    }

    if (!folder && !this.props.allowEmpty) {
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

    this.setState(
      {
        folder,
      },
      () => {
        // if this is not the same as our initial value notify parent
        if (folder && folder.value !== initialFolderId) {
          this.props.onChange({ id: folder.value!, title: folder.label! });
        }
      }
    );
  };

  render() {
    const { folder } = this.state;
    const { enableCreateNew } = this.props;

    return (
      <div aria-label={selectors.components.FolderPicker.container}>
        <AsyncSelect
          menuShouldPortal
          loadingMessage="Loading folders..."
          defaultOptions
          defaultValue={folder}
          value={folder}
          allowCustomValue={enableCreateNew}
          loadOptions={this.debouncedSearch}
          onChange={this.onFolderChange}
          onCreateOption={this.createNewFolder}
        />
      </div>
    );
  }
}

interface Args {
  getFolder: typeof getFolderById;
  folderId?: number;
  folderName?: string;
}

export async function getInitialValues({ folderName, folderId, getFolder }: Args): Promise<SelectableValue<number>> {
  if (folderId === null || folderId === undefined || folderId < 0) {
    throw new Error('folderId should to be greater or equal to zero.');
  }

  if (folderName) {
    return { label: folderName, value: folderId };
  }

  const folderDto = await getFolder(folderId);
  return { label: folderDto.title, value: folderId };
}
