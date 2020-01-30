import React, { PureComponent } from 'react';
import { Forms } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/core';

export interface Props {
  onChange: ($folder: { title: string; id: number }) => void;
  rootName?: string;
  enableReset?: boolean;
  dashboardId?: any;
  initialTitle?: string;
  initialFolderId?: number;
}

interface State {
  validationError: string;
  hasValidationError: boolean;
  folders: Array<SelectableValue<number>>;
}

export class FolderPicker extends PureComponent<Props, State> {
  static defaultProps = {
    rootName: 'General',
    enableReset: false,
    initialTitle: '',
  };

  state: State = {
    validationError: '',
    hasValidationError: false,
    folders: [],
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
    if (contextSrv.isEditor && rootName.toLowerCase().startsWith(query.toLowerCase())) {
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

    if (newFolder.__isNew__) {
      //
      newFolder = { value: -1, label: newFolder.label };
    }

    this.props.onChange({ id: newFolder.value, title: newFolder.label });
  };

  private loadInitialValue = async () => {
    const { initialTitle, rootName, initialFolderId, enableReset, dashboardId } = this.props;
    const resetFolder: SelectableValue<number> = { label: initialTitle, value: undefined };
    const rootFolder: SelectableValue<number> = { label: rootName, value: 0 };

    const options = await this.getOptions('');
    this.setState({
      folders: options,
    });

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
      this.props.onChange({ id: folder.value, title: folder.text });
    }
  };

  render() {
    const { validationError, hasValidationError } = this.state;
    const { initialFolderId, initialTitle } = this.props;

    return (
      <>
        <Forms.Field label="Folder">
          <Forms.AsyncSelect
            loadingMessage="Loading folders..."
            value={{ label: initialTitle, value: initialFolderId }}
            defaultOptions
            allowCustomValue
            loadOptions={this.getOptions}
            onChange={this.onFolderChange}
            size="sm"
          />
        </Forms.Field>
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
