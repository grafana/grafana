import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, LegacyForms } from '@grafana/ui';
const { Input } = LegacyForms;
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { ShowConfirmModalEvent } from '../../types/events';

import { deleteFolder, getFolderByUid, saveFolder } from './state/actions';
import { getLoadingNav } from './state/navModel';
import { setFolderTitle } from './state/reducers';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

const mapStateToProps = (state: StoreState, props: OwnProps) => {
  const uid = props.match.params.uid;
  return {
    pageNav: getNavModel(state.navIndex, `folder-settings-${uid}`, getLoadingNav(2)),
    folderUid: uid,
    folder: state.folder,
  };
};

const mapDispatchToProps = {
  getFolderByUid,
  saveFolder,
  setFolderTitle,
  deleteFolder,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export interface State {
  isLoading: boolean;
}

export class FolderSettingsPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isLoading: false,
    };
  }

  componentDidMount() {
    this.props.getFolderByUid(this.props.folderUid);
  }

  onTitleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.props.setFolderTitle(evt.target.value);
  };

  onSave = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    this.setState({ isLoading: true });
    await this.props.saveFolder(this.props.folder);
    this.setState({ isLoading: false });
  };

  onDelete = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    evt.preventDefault();

    const confirmationText = `Do you want to delete this folder and all its dashboards and alerts?`;
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: confirmationText,
        icon: 'trash-alt',
        yesText: 'Delete',
        onConfirm: () => {
          this.props.deleteFolder(this.props.folder.uid);
        },
      })
    );
  };

  render() {
    const { pageNav, folder } = this.props;

    return (
      <Page navId="dashboards/browse" pageNav={pageNav.main}>
        <Page.Contents isLoading={this.state.isLoading}>
          <h3 className="page-sub-heading">Folder settings</h3>

          <div className="section gf-form-group">
            <form name="folderSettingsForm" onSubmit={this.onSave}>
              <div className="gf-form">
                <label htmlFor="folder-title" className="gf-form-label width-7">
                  Name
                </label>
                <Input
                  type="text"
                  className="gf-form-input width-30"
                  id="folder-title"
                  value={folder.title}
                  onChange={this.onTitleChange}
                />
              </div>
              <div className="gf-form-button-row">
                <Button type="submit" disabled={!folder.canSave || !folder.hasChanged}>
                  Save
                </Button>
                <Button variant="destructive" onClick={this.onDelete} disabled={!folder.canDelete}>
                  Delete
                </Button>
              </div>
            </form>
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(FolderSettingsPage);
