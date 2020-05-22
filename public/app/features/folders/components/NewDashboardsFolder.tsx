import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Button, Input, Form, Field } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { createNewFolder } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import validationSrv from '../../manage-dashboards/services/ValidationSrv';

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

  validateFolderName = (folderName: string) => {
    return validationSrv
      .validateNewFolderName(folderName)
      .then(() => {
        return true;
      })
      .catch(e => {
        return e.message;
      });
  };

  render() {
    return (
      <Page navModel={this.props.navModel}>
        <Page.Contents>
          <h3>New Dashboard Folder</h3>
          <Form defaultValues={initialFormModel} onSubmit={this.onSubmit}>
            {({ register, errors }) => (
              <>
                <Field
                  label="Folder name"
                  invalid={!!errors.folderName}
                  error={errors.folderName && errors.folderName.message}
                >
                  <Input
                    name="folderName"
                    ref={register({
                      required: 'Folder name is required.',
                      validate: async v => await this.validateFolderName(v),
                    })}
                  />
                </Field>
                <Button type="submit">Create</Button>
              </>
            )}
          </Form>
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
