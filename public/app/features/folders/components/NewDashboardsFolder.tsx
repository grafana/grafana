import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Forms } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { createNewFolder } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from '../../../types';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
}

interface DispatchProps {
  createNewFolder: typeof createNewFolder;
}

interface FormModel {
  folderName: string;
}

const initialFormModel: FormModel = { folderName: '' };

type Props = OwnProps & ConnectedProps & DispatchProps;

export class NewDashboardsFolder extends PureComponent<Props> {
  onSubmit = (formData: FormModel) => {
    this.props.createNewFolder(formData.folderName);
  };

  render() {
    return (
      <Page navModel={this.props.navModel}>
        <Page.Contents>
          <Forms.Form defaultValues={initialFormModel} onSubmit={this.onSubmit}>
            {({ register, errors }) => (
              <>
                <Forms.Field label="Folder name" invalid={!!errors.folderName} error="Folder name is required.">
                  <Forms.Input name="folderName" ref={register({ required: true })} />
                </Forms.Field>
                <Forms.Button type="submit">Create</Forms.Button>
              </>
            )}
          </Forms.Form>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  navModel: getNavModel(state.navIndex, 'manage-dashboards'),
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createNewFolder,
};

export default connect(mapStateToProps, mapDispatchToProps)(NewDashboardsFolder);
