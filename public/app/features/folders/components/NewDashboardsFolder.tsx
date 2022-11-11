import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Input, Form, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';
import { createNewFolder } from '../state/actions';

const mapDispatchToProps = {
  createNewFolder,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {}

interface FormModel {
  folderName: string;
}

const initialFormModel: FormModel = { folderName: '' };

type Props = OwnProps & ConnectedProps<typeof connector>;

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
      .catch((e) => {
        return e.message;
      });
  };

  pageNav: NavModelItem = {
    text: 'Create a new folder',
    subTitle: 'Folders provide a way to group dashboards and alert rules.',
    breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
  };

  render() {
    return (
      <Page navId="dashboards/browse" pageNav={this.pageNav}>
        <Page.Contents>
          {!config.featureToggles.topnav && <h3>New dashboard folder</h3>}
          <Form defaultValues={initialFormModel} onSubmit={this.onSubmit}>
            {({ register, errors }) => (
              <>
                <Field
                  label="Folder name"
                  invalid={!!errors.folderName}
                  error={errors.folderName && errors.folderName.message}
                >
                  <Input
                    id="folder-name-input"
                    {...register('folderName', {
                      required: 'Folder name is required.',
                      validate: async (v) => await this.validateFolderName(v),
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

export default connector(NewDashboardsFolder);
