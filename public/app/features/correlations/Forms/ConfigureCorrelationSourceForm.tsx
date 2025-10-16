import { css } from '@emotion/css';
import { Controller, useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Card, Field, FieldSet, Input, Stack, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { getVariableUsageInfo } from '../../explore/utils/links';

import { TransformationsEditor } from './TransformationsEditor';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { FormDTO } from './types';
import { getInputId } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    maxWidth: theme.spacing(80),
  }),
  variable: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

const getFormText = (queryType: string, dataSourceName?: string) => {
  if (queryType === 'query') {
    return {
      title: t(
        'correlations.source-form.query-title',
        'Configure the data source that will link to {{dataSourceName}} (Step 3 of 3)',
        { dataSourceName }
      ),
      descriptionPre: t(
        'correlations.source-form.description-query-pre',
        'You have used following variables in the target query:'
      ),
      heading: t('correlations.source-form.heading-query', 'Variables used in the target query'),
    };
  } else {
    return {
      title: t(
        'correlations.source-form.external-title',
        'Configure the data source that will use the URL (Step 3 of 3)'
      ),
      descriptionPre: t(
        'correlations.source-form.description-external-pre',
        'You have used following variables in the target URL:'
      ),
      heading: t('correlations.source-form.heading-external', 'Variables used in the target URL'),
    };
  }
};

export const ConfigureCorrelationSourceForm = () => {
  const { control, formState, register, getValues } = useFormContext<FormDTO>();
  const styles = useStyles2(getStyles);
  const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);

  const { correlation, readOnly } = useCorrelationsFormContext();

  const currentTargetQuery = getValues('config.target');
  const currentType = getValues('type');
  const variables = getVariableUsageInfo(currentTargetQuery, {}).variables.map(
    (variable) => variable.variableName + (variable.fieldPath ? `.${variable.fieldPath}` : '')
  );
  const dataSourceName = getDatasourceSrv().getInstanceSettings(getValues('targetUID'))?.name;

  const formText = getFormText(currentType, dataSourceName);

  function VariableList() {
    return (
      <>
        {variables.map((name, i) => (
          <span className={styles.variable} key={i}>
            {name}
            {i < variables.length - 1
              ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                ', '
              : ''}
          </span>
        ))}
      </>
    );
  }

  return (
    <>
      <FieldSet label={formText.title}>
        <Trans i18nKey="correlations.source-form.sub-text">
          <p>
            Define what data source will display the correlation, and what data will replace previously defined
            variables.
          </p>
        </Trans>
        <Stack direction="column" gap={2}>
          <Controller
            control={control}
            name="sourceUID"
            rules={{
              required: {
                value: true,
                message: t('correlations.source-form.control-required', 'This field is required.'),
              },
            }}
            render={({ field: { onChange, value } }) => (
              <Field
                noMargin
                label={t('correlations.source-form.source-label', 'Source')}
                description={t(
                  'correlations.source-form.source-description',
                  'Results from selected source data source have links displayed in the panel'
                )}
                htmlFor="source"
                invalid={!!formState.errors.sourceUID}
                error={formState.errors.sourceUID?.message}
              >
                <DataSourcePicker
                  onChange={withDsUID(onChange)}
                  noDefault
                  current={value}
                  inputId="source"
                  width={32}
                  disabled={correlation !== undefined}
                />
              </Field>
            )}
          />

          <Field
            noMargin
            label={t('correlations.source-form.results-label', 'Results field')}
            description={t(
              'correlations.source-form.results-description',
              'The link will be shown next to the value of this field'
            )}
            className={styles.label}
            invalid={!!formState.errors?.config?.field}
            error={formState.errors?.config?.field?.message}
          >
            <Input
              id={getInputId('field', correlation)}
              {...register('config.field', {
                required: t('correlations.source-form.results-required', 'This field is required.'),
              })}
              readOnly={readOnly}
            />
          </Field>
          {variables.length > 0 && (
            <Card noMargin>
              <Card.Heading>{formText.heading}</Card.Heading>
              <Card.Description>
                {formText.descriptionPre}
                <VariableList />
                <br />
                <Trans i18nKey="correlations.source-form.description">
                  A data point needs to provide values to all variables as fields or as transformations output to make
                  the correlation button appear in the visualization.
                  <br />
                  Note: Not every variable needs to be explicitly defined below. A transformation such as{' '}
                  <span className={styles.variable}>logfmt</span> will create variables for every key/value pair.
                </Trans>
              </Card.Description>
            </Card>
          )}
          <TransformationsEditor readOnly={readOnly} />
        </Stack>
      </FieldSet>
    </>
  );
};
