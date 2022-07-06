import { debounce } from 'lodash';
import React, { PureComponent } from 'react';

import { AppEvents, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ActionMeta, AsyncSelect, LoadOptionsCallback } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderById, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from 'app/features/search/types';

import { AccessControlAction, PermissionLevelString } from '../../../types';
import appEvents from '../../app_events';

export type FolderPickerFilter = (hits: DashboardSearchHit[]) => DashboardSearchHit[];

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  enableCreateNew?: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: any;
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

    this.debouncedSearch = debounce(this.loadOptions, 300, {
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

  // when debouncing, we must use the callback form of react-select's loadOptions so we don't
  // drop results for user input. This must not return a promise/use await.
  loadOptions = (query: string, callback: LoadOptionsCallback<number>): void => {
    this.searchFolders(query).then(callback);
  };

  private searchFolders = async (query: string) => {
    const {
      rootName,
      enableReset,
      initialTitle,
      permissionLevel,
      filter,
      accessControlMetadata,
      initialFolderId,
      showRoot,
    } = this.props;

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

    return options;
  };

  onFolderChange = (newFolder: SelectableValue<number>, actionMeta: ActionMeta) => {
    if (!newFolder) {
      newFolder = { value: 0, label: this.props.rootName };
    }

    if (actionMeta.action === 'clear' && this.props.onClear) {
      this.props.onClear();
      return;
    }

    this.setState(
      {
        folder: newFolder,
      },
      () => this.props.onChange({ id: newFolder.value!, title: newFolder.label! })
    );
  };

  createNewFolder = async (folderName: string) => {
    const newFolder = await createFolder({ title: folderName });
    let folder: SelectableValue<number> = { value: -1, label: 'Not created' };

    if (newFolder.id > -1) {
      appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
      folder = { value: newFolder.id, label: newFolder.title };

      this.setState(
        {
          folder: newFolder,
        },
        () => {
          this.onFolderChange(folder, { action: 'create-option', option: folder });
        }
      );
    } else {
      appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
    }

    return folder;
  };

  private loadInitialValue = async () => {
    const { initialTitle, rootName, initialFolderId, enableReset, dashboardId } = this.props;
    const resetFolder: SelectableValue<number> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<number> = { label: rootName, value: 0 };

    const options = await this.searchFolders('');

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
    const { enableCreateNew, inputId, onClear } = this.props;
    const isClearable = typeof onClear === 'function';

    return (
      <div data-testid={selectors.components.FolderPicker.containerV2}>
        <AsyncSelect
          inputId={inputId}
          aria-label={selectors.components.FolderPicker.input}
          loadingMessage="Loading folders..."
          defaultOptions
          defaultValue={folder}
          value={folder}
          allowCustomValue={enableCreateNew}
          loadOptions={this.debouncedSearch}
          onChange={this.onFolderChange}
          onCreateOption={this.createNewFolder}
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
