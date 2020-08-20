import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { AppEvents, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { selectors } from '@grafana/e2e-selectors';

import appEvents from '../../app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { createFolder } from 'app/features/manage-dashboards/state/actions';

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  enableCreateNew?: boolean;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: any;
  initialTitle?: string;
  initialFolderId?: number;
  useNewForms?: boolean;
}

interface State {
  folder: SelectableValue<number>;
}

export class FolderPicker extends PureComponent<Props, State> {
  debouncedSearch: any;

  constructor(props: Props) {
    super(props);

    this.state = {
      folder: {},
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
    useNewForms: false,
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

    // TODO: move search to BackendSrv interface
    // @ts-ignore
    const searchHits = (await getBackendSrv().search(params)) as DashboardSearchHit[];
    const options: Array<SelectableValue<number>> = searchHits.map(hit => ({ label: hit.title, value: hit.id }));
    if (contextSrv.isEditor && rootName?.toLowerCase().startsWith(query.toLowerCase())) {
      options.unshift({ label: rootName, value: 0 });
    }

    if (enableReset && query === '' && initialTitle !== '') {
      options.unshift({ label: initialTitle, value: undefined });
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

    let folder: SelectableValue<number> = { value: -1 };

    if (initialFolderId !== undefined && initialFolderId !== null && initialFolderId > -1) {
      folder = options.find(option => option.value === initialFolderId) || { value: -1 };
    } else if (enableReset && initialTitle) {
      folder = resetFolder;
    }

    if (folder.value === -1) {
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
        if (folder.value !== initialFolderId) {
          this.props.onChange({ id: folder.value!, title: folder.text });
        }
      }
    );
  };

  render() {
    const { folder } = this.state;
    const { enableCreateNew, useNewForms } = this.props;

    return (
      <div aria-label={selectors.components.FolderPicker.container}>
        {useNewForms && (
          <AsyncSelect
            loadingMessage="Loading folders..."
            defaultOptions
            defaultValue={folder}
            value={folder}
            allowCustomValue={enableCreateNew}
            loadOptions={this.debouncedSearch}
            onChange={this.onFolderChange}
            onCreateOption={this.createNewFolder}
            menuPosition="fixed"
          />
        )}
        {!useNewForms && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <label className="gf-form-label width-7">Folder</label>
              <AsyncSelect
                loadingMessage="Loading folders..."
                defaultOptions
                defaultValue={folder}
                value={folder}
                className={'width-20'}
                allowCustomValue={enableCreateNew}
                loadOptions={this.debouncedSearch}
                onChange={this.onFolderChange}
                onCreateOption={this.createNewFolder}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}
