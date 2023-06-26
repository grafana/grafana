import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Input, Form, Field, HorizontalGroup, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

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

type Props = OwnProps & ConnectedProps<typeof connector>;

const initialFormModel: FormModel = { folderName: '' };

const pageNav: NavModelItem = {
  text: 'Create a new folder',
  subTitle: 'Folders provide a way to group dashboards and alert rules.',
};

function NewDashboardsFolder({ createNewFolder }: Props) {
  const [queryParams] = useQueryParams();
  const onSubmit = (formData: FormModel) => {
    const folderUid = typeof queryParams['folderUid'] === 'string' ? queryParams['folderUid'] : undefined;

    createNewFolder(formData.folderName, folderUid);
  };

  const validateFolderName = (folderName: string) => {
    return validationSrv
      .validateNewFolderName(folderName)
      .then(() => {
        return true;
      })
      .catch((e) => {
        return e.message;
      });
  };

  return (
    <Page navId="dashboards/browse" pageNav={pageNav}>
      <Page.Contents>
        <Form defaultValues={initialFormModel} onSubmit={onSubmit}>
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
                    validate: async (v) => await validateFolderName(v),
                  })}
                />
              </Field>
              <HorizontalGroup>
                <Button type="submit">Create</Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/dashboards`}>
                  Cancel
                </LinkButton>
              </HorizontalGroup>
            </>
          )}
        </Form>
      </Page.Contents>
    </Page>
  );
}

export default connector(NewDashboardsFolder);
