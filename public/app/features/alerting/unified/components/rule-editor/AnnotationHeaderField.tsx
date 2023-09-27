import { css } from '@emotion/css';
import React from 'react';
import { FieldArrayWithId, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { InputControl, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationDescriptions, annotationLabels } from '../../utils/constants';

import CustomAnnotationHeaderField from './CustomAnnotationHeaderField';

const AnnotationHeaderField = ({
  annotationField,
  annotations,
  annotation,
  index,
}: {
  annotationField: FieldArrayWithId<RuleFormValues, 'annotations', 'id'>;
  annotations: Array<{ key: string; value: string }>;
  annotation: Annotation;
  index: number;
}) => {
  const styles = useStyles2(getStyles);
  const { control } = useFormContext<RuleFormValues>();
  return (
    <div>
      <label className={styles.annotationContainer}>
        {
          <InputControl
            name={`annotations.${index}.key`}
            defaultValue={annotationField.key}
            render={({ field: { ref, ...field } }) => {
              switch (annotationField.key) {
                case Annotation.dashboardUID:
                  return <div>Dashboard and panel</div>;
                case Annotation.panelID:
                  return <span></span>;
                default:
                  return (
                    <div>
                      {annotationLabels[annotation] && (
                        <span className={styles.annotationTitle} data-testid={`annotation-key-${index}`}>
                          {annotationLabels[annotation]}
                          {' (optional)'}
                        </span>
                      )}
                      {!annotationLabels[annotation] && <CustomAnnotationHeaderField field={field} />}
                    </div>
                  );
              }
            }}
            control={control}
            rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
          />
        }
      </label>
      <div className={styles.annotationDescription}>{annotationDescriptions[annotation]}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annotationTitle: css`
    color: ${theme.colors.text.primary};
    margin-bottom: 3px;
  `,

  annotationContainer: css`
    margin-top: 5px;
  `,

  annotationDescription: css`
    color: ${theme.colors.text.secondary};
  `,
});

export default AnnotationHeaderField;
