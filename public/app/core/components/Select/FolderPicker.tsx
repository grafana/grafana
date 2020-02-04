import React, { PureComponent } from 'react';
import { Forms } from '@grafana/ui';
import { AppEvents, SelectableValue } from '@grafana/data';
import { debounce } from 'lodash';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/core';
import appEvents from '../../app_events';

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  enableCreateNew: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: any;
  initialTitle?: string;
  initialFolderId?: number;
}

interface State {
  validationError: string;
  hasValidationError: boolean;
}

export class FolderPicker extends PureComponent<Props, State> {
  debouncedSearch: any;
  constructor(props: Props) {
    super(props);

    this.state = {
      validationError: '',
      hasValidationError: false,
    };

    this.debouncedSearch = debounce(this.getOptions, 300, {
      leading: true,
      trailing: true,
    });
  }

  static defaultProps = {
    rootName: 'General',
    enableReset: false,
    initialTitle: '',
    enableCreateNew: false,
  };

  componentDidMount = async () => {
    await this.loadInitialValue();
  };

  getOptions = async (query: string) => {
    const { rootName, enableReset, initialTitle } = this.props;
    const params = {
      query,
      type: 'dash-folder',
      permission: 'Edit',
    };

    const searchHits = await getBackendSrv().search(params);
    const options: Array<SelectableValue<number>> = searchHits.map(hit => ({ label: hit.title, value: hit.id }));
    if (contextSrv.isEditor && rootName?.toLowerCase().startsWith(query.toLowerCase())) {
      options.unshift({ label: rootName, value: 0 });
    }

    if (enableReset && query === '' && initialTitle !== '') {
      options.unshift({ label: initialTitle, value: undefined });
    }

    return options;
  };

  onFolderChange = async (newFolder: SelectableValue<number>) => {
    if (!newFolder) {
      newFolder = { value: 0, label: this.props.rootName };
    }

    if (newFolder.value ?? -1 > 0) {
      this.props.onChange({ id: newFolder.value!, title: newFolder.label! });
    }
  };

  createNewFolder = async (folderName: string) => {
    const newFolder = await getBackendSrv().createFolder({ title: folderName });
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

    let folder: SelectableValue<number> = { value: -1 };
    if (initialFolderId) {
      folder = options.find(option => option.value === initialFolderId) || { value: -1 };
    } else if (enableReset && initialTitle && initialFolderId === undefined) {
      folder = resetFolder;
    }

    if (!folder) {
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

    // if this is not the same as our initial value notify parent
    if (folder.value !== initialFolderId) {
      this.props.onChange({ id: folder.value!, title: folder.text });
    }
  };

  render() {
    const { validationError, hasValidationError } = this.state;
    const { enableCreateNew } = this.props;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label width-7">Folder</label>
            <Forms.AsyncSelect
              loadingMessage="Loading folders..."
              defaultOptions
              allowCustomValue={enableCreateNew}
              loadOptions={this.debouncedSearch}
              onChange={this.onFolderChange}
              onCreateOption={this.createNewFolder}
              size="sm"
            />
          </div>
        </div>
        {hasValidationError && (
          <div className="gf-form-inline">
            <div className="gf-form gf-form--grow">
              <label className="gf-form-label text-warning gf-form-label--grow">
                <i className="fa fa-warning" />
                {validationError}
              </label>
            </div>
          </div>
        )}
      </>
    );
  }
}
