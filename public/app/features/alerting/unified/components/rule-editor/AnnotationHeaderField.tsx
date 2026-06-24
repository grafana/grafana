import { Controller, type FieldArrayWithId, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { type RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationDescriptions, annotationLabels } from '../../utils/constants';

import CustomAnnotationHeaderField from './CustomAnnotationHeaderField';

const AnnotationHeaderField = ({
  annotationField,
  annotations,
  annotation,
  index,
  labelId,
}: {
  annotationField: FieldArrayWithId<RuleFormValues, 'annotations', 'id'>;
  annotations: Array<{ key: string; value: string }>;
  annotation: Annotation;
  index: number;
  labelId: string;
}) => {
  const { control } = useFormContext<RuleFormValues>();

  // The org admin config can make certain annotations mandatory; when it does we drop
  // the "(optional)" hint so the editor matches what the API will enforce on save.
  const { currentData: alertingConfig } = alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery();
  const requireDescriptions = alertingConfig?.reject_alerts_without_descriptions ?? false;
  const requireRunbookURL = alertingConfig?.reject_alerts_without_runbook_url ?? false;
  const isRequired =
    (requireDescriptions && (annotation === Annotation.summary || annotation === Annotation.description)) ||
    (requireRunbookURL && annotation === Annotation.runbookURL);

  return (
    <Stack direction="column" gap={0}>
      <label htmlFor={labelId}>
        {
          <Controller
            name={`annotations.${index}.key`}
            defaultValue={annotationField.key}
            render={({ field: { ref, ...field } }) => {
              if (!annotationLabels[annotation]) {
                return <CustomAnnotationHeaderField field={field} />;
              }

              let label;

              switch (annotationField.key) {
                case Annotation.dashboardUID:
                  label = 'Dashboard and panel';
                  break;
                case Annotation.panelID:
                  label = '';
                  break;
                default:
                  label =
                    annotationLabels[annotation] && annotationLabels[annotation] + (isRequired ? '' : ' (optional)');
              }

              return (
                <span data-testid={`annotation-key-${index}`}>
                  <Text color="primary" variant="bodySmall">
                    {label}
                  </Text>
                </span>
              );
            }}
            control={control}
            rules={{
              required: {
                value: !!annotations[index]?.value,
                message: t('alerting.annotation-header-field.message.required', 'Required.'),
              },
            }}
          />
        }
      </label>
      <Text variant="bodySmall" color="secondary">
        {annotationDescriptions[annotation]}
      </Text>
    </Stack>
  );
};

export default AnnotationHeaderField;
