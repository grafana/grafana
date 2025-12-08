import { css } from '@emotion/css';
import { useMemo } from 'react';
import { FormProvider, SubmitErrorHandler, useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { DataSourceStackSpec } from 'app/features/connections/pages/DataSourceStacksPage';

import { StackModes } from './StackModes';
import { StackName } from './StackName';
import { StackTemplate } from './StackTemplate';
import { StackFormValues } from './types';

type Props = {
  existing?: StackFormValues;
};

const defaultValues: StackFormValues = {
  name: '',
  templates: [],
  modes: [],
};

export const StackForm = ({ existing }: Props) => {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();

  const initialValues: StackFormValues = useMemo(() => {
    if (existing) {
      return existing;
    }
    return defaultValues;
  }, [existing]);

  const formAPI = useForm<StackFormValues>({
    mode: 'onSubmit',
    defaultValues: initialValues,
    shouldFocusError: true,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = formAPI;

  const submit = async (values: StackFormValues): Promise<void> => {
    const payload = prepareCreateStackPayload(values);
    console.log('Form submitted with payload:', payload);
    // TODO: Call API to save the stack using payload
    notifyApp.success('Stack saved successfully!');
  };

  const onInvalid: SubmitErrorHandler<StackFormValues> = () => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <div className={styles.contentOuter}>
          <Stack direction="column" gap={3}>
            {/* Step 1 - name */}
            <StackName />

            {/* Step 2 - Templates */}
            <StackTemplate />

            {/* Step 3 - Modes */}
            <StackModes />

            {/* Actions */}
            <Stack direction="row" alignItems="center">
              <Button
                variant="primary"
                type="button"
                onClick={handleSubmit((values) => submit(values), onInvalid)}
                disabled={isSubmitting}
                icon={isSubmitting ? 'spinner' : undefined}
              >
                <Trans i18nKey="datasources.stack-form.save">Save</Trans>
              </Button>
            </Stack>
          </Stack>
        </div>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  contentOuter: css({
    background: theme.colors.background.primary,
    overflow: 'hidden',
    maxWidth: theme.breakpoints.values.xl,
    flex: 1,
  }),
});

export const prepareCreateStackPayload = (formValues: StackFormValues): DataSourceStackSpec => {
  // creates a mapping from template name to UUID
  const templateNameToUuid: Record<string, string> = {};
  formValues.templates.forEach((template) => {
    templateNameToUuid[template.name] = uuidv4();
  });

  // builds the template record with UUIDs as keys
  const template: DataSourceStackSpec['template'] = {};
  formValues.templates.forEach((t) => {
    const uuid = templateNameToUuid[t.name];
    template[uuid] = {
      group: t.type,
      name: t.name,
    };
  });
  // uses template ids to build modes
  const modes: DataSourceStackSpec['modes'] = formValues.modes.map((mode) => {
    const definition: Record<string, { dataSourceRef: string }> = {};

    Object.entries(mode.datasources).forEach(([templateName, dataSourceUid]) => {
      const uuid = templateNameToUuid[templateName];
      if (uuid) {
        definition[uuid] = { dataSourceRef: dataSourceUid };
      }
    });

    return {
      name: mode.name,
      uid: uuidv4(),
      definition,
    };
  });

  return { template, modes };
};

//used when loading an existing stack for editing.
export const transformStackSpecToFormValues = (stackName: string, spec: DataSourceStackSpec): StackFormValues => {
  const uuidToTemplateName: Record<string, string> = {};
  Object.entries(spec.template).forEach(([uuid, templateItem]) => {
    uuidToTemplateName[uuid] = templateItem.name;
  });

  const templates = Object.values(spec.template).map((templateItem) => ({
    name: templateItem.name,
    type: templateItem.group,
  }));

  const modes = spec.modes.map((mode) => {
    const datasources: Record<string, string> = {};

    Object.entries(mode.definition).forEach(([uuid, modeItem]) => {
      const templateName = uuidToTemplateName[uuid];
      if (templateName) {
        datasources[templateName] = modeItem.dataSourceRef;
      }
    });

    return {
      name: mode.name,
      datasources,
    };
  });

  return {
    name: stackName,
    templates,
    modes,
  };
};
