import { FC, useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';

import { Field, Input, useStyles2, PageToolbar, ToolbarButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';

import LabelsField from '../LabelsField';

import { Messages } from './AddEditRoleForm.messages';
import { getStyles } from './AddEditRoleForm.styles';
import { AddEditRoleFormProps } from './AddEditRoleForm.types';

const AddEditRoleForm: FC<AddEditRoleFormProps> = ({
  initialValues,
  isLoading,
  cancelLabel,
  onCancel,
  submitLabel,
  onSubmit,
  title,
}) => {
  const methods = useForm({
    defaultValues: initialValues,
  });
  const errors = methods.formState.errors;
  const styles = useStyles2(getStyles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('enableAccessControl'), []);
  const history = useHistory();

  useEffect(() => {
    methods.reset(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const handleGoBack = () => {
    history.push('/roles');
  };

  return (
    <FormProvider {...methods}>
      <PageToolbar title={title} onGoBack={handleGoBack}>
        <ToolbarButton data-testid="add-edit-role-cancel" type="button" onClick={onCancel} variant="canvas">
          {cancelLabel}
        </ToolbarButton>
        <ToolbarButton
          data-testid="add-edit-role-submit"
          type="submit"
          variant="primary"
          onClick={methods.handleSubmit(onSubmit)}
        >
          {submitLabel}
        </ToolbarButton>
      </PageToolbar>
      <Page.Contents isLoading={isLoading} className={styles.pageContainer}>
        <FeatureLoader featureSelector={featureSelector}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <div className={styles.page}>
              <Field label={Messages.name.label} invalid={!!errors.title} error={errors.title?.message}>
                <Input
                  data-testid="role-name-field"
                  {...methods.register('title', { required: Messages.name.required })}
                  type="text"
                  placeholder={Messages.name.placeholder}
                />
              </Field>
              <Field label={Messages.description.label} description={Messages.description.description}>
                <Input
                  data-testid="role-description-field"
                  {...methods.register('description')}
                  type="text"
                  placeholder={Messages.description.placeholder}
                />
              </Field>
              <Field
                label={Messages.metrics.label}
                invalid={!!errors.filter}
                error={errors.filter?.message}
                description={Messages.metrics.description}
              >
                <LabelsField control={methods.control} />
              </Field>
            </div>
            {/* Cancel button was triggering on form submit */}
            <button type="submit" className={styles.none} />
          </form>
        </FeatureLoader>
      </Page.Contents>
    </FormProvider>
  );
};

export default AddEditRoleForm;
