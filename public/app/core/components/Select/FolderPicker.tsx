import React, { PureComponent } from 'react';
import { Button, Input, AsyncSelect } from '@grafana/ui';
import { AppEvents, SelectableValue } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { appEvents, contextSrv } from 'app/core/core';
import validationSrv from 'app/features/manage-dashboards/services/ValidationSrv';

export interface Props {
  onChange: ($folder: { id: number; title: string }) => void;

  labelClass?: string;
  rootName?: string;
  enableCreateNew?: boolean;
  enableReset?: boolean;
  dashboardId?: any;
  initialTitle?: string;
  initialFolderId?: number;

  enterFolderCreation?: () => void;
  exitFolderCreation?: () => void;
}

interface State {
  folder: SelectableValue<number>;
  newFolderName: string;
  createNewFolder: boolean;
  validationError: string;
  hasValidationError: boolean;
  newFolderNameTouched: boolean;
  isLoading: boolean;
}

export class FolderPicker extends PureComponent<Props, State> {
  static defaultProps = {
    rootName: 'General',
    enableCreateNew: false,
    enableReset: false,
    initialTitle: '',
  };

  state: State = {
    folder: {},
    newFolderName: '',
    createNewFolder: false,
    validationError: '',
    hasValidationError: false,
    newFolderNameTouched: false,
    isLoading: true,
  };

  componentDidMount = async () => {
    await this.loadInitialValue();
  };

  getOptions = async (query: string) => {
    this.setState({
      isLoading: true,
    });

    const { rootName, enableCreateNew, enableReset, initialTitle } = this.props;
    const params = {
      query,
      type: 'dash-folder',
      permission: 'Edit',
    };

    const searchHits = await getBackendSrv().search(params);
    const options: Array<SelectableValue<number>> = searchHits.map(hit => ({ label: hit.title, value: hit.id }));
    if (contextSrv.isEditor && rootName.toLowerCase().startsWith(query.toLowerCase())) {
      options.unshift({ label: rootName, value: 0 });
    }

    if (contextSrv.isEditor && enableCreateNew && query === '') {
      options.unshift({ label: '-- New Folder --', value: -1 });
    }

    if (enableReset && query === '' && initialTitle !== '') {
      options.unshift({ label: initialTitle, value: undefined });
    }

    this.setState({
      isLoading: false,
    });
    return options;
  };

  onFolderChange = (newFolder: SelectableValue<number>) => {
    if (!newFolder) {
      newFolder = { value: 0, label: this.props.rootName };
    } else if (newFolder.value === -1) {
      this.setState({
        createNewFolder: true,
      });
      this.props.enterFolderCreation?.();
      return;
    }

    this.setState(
      {
        folder: newFolder,
      },
      () => this.props.onChange({ id: newFolder.value, title: newFolder.text })
    );
  };

  onNewFolderNameChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      newFolderNameTouched: true,
      newFolderName: event.target.value,
    });

    try {
      await validationSrv.validateNewFolderName(event.target.value);
      this.setState({
        hasValidationError: false,
      });
    } catch (err) {
      this.setState({
        hasValidationError: true,
        validationError: err.message,
      });
    }
  };

  createFolder = async (evt: React.MouseEvent) => {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    const result: { title: string; id: number } = await getBackendSrv().createFolder({
      title: this.state.newFolderName,
    });
    appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);

    this.onFolderChange({ label: result.title, value: result.id });
    this.closeCreateFolder();
  };

  cancelCreateFolder = (evt: React.MouseEvent) => {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    this.closeCreateFolder();
    this.loadInitialValue();
  };

  private closeCreateFolder = () => {
    this.props.exitFolderCreation?.();
    this.setState({
      createNewFolder: false,
      hasValidationError: false,
      validationError: undefined,
      newFolderName: '',
      newFolderNameTouched: false,
    });
  };

  private loadInitialValue = async () => {
    const { initialTitle, rootName, initialFolderId, enableReset, dashboardId } = this.props;
    const resetFolder: SelectableValue<number> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<number> = { label: rootName, value: 0 };

    const options = await this.getOptions('');
    let folder: SelectableValue<number>;
    if (initialFolderId) {
      folder = options.find(option => option.value === initialFolderId);
    } else if (enableReset && initialTitle && initialFolderId === undefined) {
      folder = resetFolder;
    }

    if (!folder) {
      if (contextSrv.isEditor) {
        folder = rootFolder;
      } else {
        // We shouldn't assign a random folder without the user actively choosing it on a persisted dashboard
        const isPersistedDashBoard = dashboardId ? true : false;
        if (isPersistedDashBoard) {
          folder = resetFolder;
        } else {
          folder = options.length > 0 ? options[0] : resetFolder;
        }
      }
    }

    this.setState({
      folder,
    });

    // if this is not the same as our initial value notify parent
    if (folder.value !== initialFolderId) {
      this.props.onChange({ id: folder.value, title: folder.text });
    }
  };

  render() {
    const { labelClass } = this.props;
    const {
      folder,
      newFolderName,
      createNewFolder,
      validationError,
      hasValidationError,
      newFolderNameTouched,
      isLoading,
    } = this.state;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className={`gf-form-label ${labelClass ?? 'width-7'}`}>Folder</label>
            {!createNewFolder && (
              <AsyncSelect
                isLoading={isLoading}
                value={folder}
                defaultOptions={true}
                loadOptions={this.getOptions}
                onChange={this.onFolderChange}
              />
            )}
            {createNewFolder && (
              <Input
                autoFocus
                type="text"
                className="gf-form-input max-width-10"
                value={newFolderName}
                onChange={this.onNewFolderNameChange}
              />
            )}
          </div>
          {createNewFolder && (
            <>
              <div className="gf-form">
                <Button
                  variant="inverse"
                  onClick={this.createFolder}
                  disabled={!newFolderNameTouched || hasValidationError}
                >
                  Create
                </Button>
              </div>
              <div className="gf-form">
                <Button variant="inverse" onClick={this.cancelCreateFolder}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
        {newFolderNameTouched && hasValidationError && (
          <div className="gf-form-inline">
            <div className="gf-form gf-form--grow">
              <label className="gf-form-label text-warning gf-form-label--grow">
                <i className="fa fa-warning"></i>
                {validationError}
              </label>
            </div>
          </div>
        )}
      </>
    );
  }
}
