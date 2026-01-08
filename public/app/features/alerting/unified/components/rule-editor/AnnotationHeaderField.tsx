import { Controller, FieldArrayWithId, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
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
                  label = annotationLabels[annotation] && annotationLabels[annotation] + ' (optional)';
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
