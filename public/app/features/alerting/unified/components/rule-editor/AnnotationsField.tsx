import { css, cx } from '@emotion/css';
import produce from 'immer';
import React, { useCallback } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, Input, TextArea, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationDescriptions, annotationLabels } from '../../utils/constants';

import { DashboardPicker } from './DashboardPicker';

const AnnotationsField = () => {
  const styles = useStyles2(getStyles);
  const [showPanelSelector, setShowPanelSelector] = useToggle(false);

  const {
    control,
    register,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  const selectedDashboardUid = annotations.find((annotation) => annotation.key === Annotation.dashboardUID)?.value;
  const selectedPanelId = annotations.find((annotation) => annotation.key === Annotation.panelID)?.value;

  const setSelectedDashboardAndPanelId = (dashboardUid: string, panelId: string) => {
    const updatedAnnotations = produce(annotations, (draft) => {
      const dashboardAnnotation = draft.find((a) => a.key === Annotation.dashboardUID);
      const panelAnnotation = draft.find((a) => a.key === Annotation.panelID);

      if (dashboardAnnotation) {
        dashboardAnnotation.value = dashboardUid;
      } else {
        draft.push({ key: Annotation.dashboardUID, value: dashboardUid });
      }

      if (panelAnnotation) {
        panelAnnotation.value = panelId;
      } else {
        draft.push({ key: Annotation.panelID, value: panelId });
      }
    });

    setValue('annotations', updatedAnnotations);
    setShowPanelSelector(false);
  };

  return (
    <>
      <div className={styles.flexColumn}>
        {fields.map((annotationField, index: number) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;
          // eslint-disable-next-line
          const annotation = annotationField.key as Annotation;

          return (
            <div key={annotationField.id} className={styles.flexRow}>
              <div>
                <div>
                  <label>
                    {annotationLabels[annotation]} {annotationLabels[annotation] ? '(optional)' : ''}
                  </label>
                  <div>{annotationDescriptions[annotation]}</div>
                </div>
                <Field
                  className={cx(styles.flexRowItemMargin, styles.field)}
                  invalid={!!errors.annotations?.[index]?.value?.message}
                  error={errors.annotations?.[index]?.value?.message}
                >
                  <ValueInputComponent
                    data-testid={`annotation-value-${index}`}
                    className={cx(styles.annotationValueInput, { [styles.textarea]: !isUrl })}
                    {...register(`annotations.${index}.value`)}
                    placeholder={isUrl ? 'https://' : `Text`}
                    defaultValue={annotationField.value}
                  />
                </Field>
                {!annotationLabels[annotation] && (
                  <Button
                    type="button"
                    className={styles.deleteAnnotationButton}
                    aria-label="delete annotation"
                    icon="trash-alt"
                    variant="secondary"
                    onClick={() => remove(index)}
                  />
                )}
              </div>
            </div>
          );
        })}
        <Stack direction="row" gap={1}>
          <div className={styles.addAnnotationsButtonContainer}>
            <Button
              icon="plus-circle"
              type="button"
              variant="secondary"
              onClick={() => {
                append({ key: '', value: '' });
              }}
            >
              Add annotation
            </Button>
            <Button type="button" variant="secondary" icon="dashboard" onClick={() => setShowPanelSelector(true)}>
              Set dashboard and panel
            </Button>
          </div>
        </Stack>
        {showPanelSelector && (
          <DashboardPicker
            isOpen={true}
            dashboardUid={selectedDashboardUid}
            panelId={selectedPanelId}
            onChange={setSelectedDashboardAndPanelId}
            onDismiss={() => setShowPanelSelector(false)}
          />
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annotationValueInput: css`
    width: 394px;
  `,
  textarea: css`
    height: 76px;
  `,
  addAnnotationsButtonContainer: css`
    margin-top: ${theme.spacing(1)};
    gap: ${theme.spacing(1)};
    display: flex;
  `,
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,
  field: css`
    margin-bottom: ${theme.spacing(0.5)};
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
  flexRowItemMargin: css`
    margin-top: ${theme.spacing(1)};
  `,
  deleteAnnotationButton: css`
    display: inline-block;
  `,
});

export default AnnotationsField;
