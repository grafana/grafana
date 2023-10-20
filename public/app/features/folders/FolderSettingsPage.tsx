import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Field, Form, Button, Input, InputControl } from '@grafana/ui';
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

  onSave = () => {
    this.setState({ isLoading: true });
    this.props.saveFolder(this.props.folder);
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
          <Form name="folderSettingsForm" onSubmit={this.onSave}>
            {({ control, errors }) => (
              <>
                <InputControl
                  render={({ field: { ref, ...field } }) => (
                    <Field label="Title" invalid={!!errors.title} error={errors.title?.message}>
                      <Input {...field} autoFocus onChange={this.onTitleChange} value={folder.title} />
                    </Field>
                  )}
                  control={control}
                  name="title"
                />
                <div className="gf-form-button-row">
                  <Button type="submit" disabled={!folder.canSave || !folder.hasChanged}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={this.onDelete} disabled={!folder.canDelete}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(FolderSettingsPage);
