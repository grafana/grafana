import { css, cx } from '@emotion/css';
import produce from 'immer';
import React, { useCallback } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, Input, InputControl, Label, TextArea, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';

import { AnnotationKeyInput } from './AnnotationKeyInput';
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

  const existingKeys = useCallback(
    (index: number): string[] => annotations.filter((_, idx: number) => idx !== index).map(({ key }) => key),
    [annotations]
  );

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
      <Label>Summary and annotations</Label>
      <div className={styles.flexColumn}>
        {fields.map((annotationField, index) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;

          return (
            <div key={annotationField.id} className={styles.flexRow}>
              <Field
                className={styles.field}
                invalid={!!errors.annotations?.[index]?.key?.message}
                error={errors.annotations?.[index]?.key?.message}
                data-testid={`annotation-key-${index}`}
              >
                <InputControl
                  name={`annotations.${index}.key`}
                  defaultValue={annotationField.key}
                  render={({ field: { ref, ...field } }) => (
                    <AnnotationKeyInput
                      {...field}
                      aria-label={`Annotation detail ${index + 1}`}
                      existingKeys={existingKeys(index)}
                      width={18}
                    />
                  )}
                  control={control}
                  rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                />
              </Field>
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
              <Button
                type="button"
                className={styles.flexRowItemMargin}
                aria-label="delete annotation"
                icon="trash-alt"
                variant="secondary"
                onClick={() => remove(index)}
              />
            </div>
          );
        })}
        <Stack direction="row" gap={1}>
          <Button
            className={styles.addAnnotationsButton}
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
  addAnnotationsButton: css`
    flex-grow: 0;
    align-self: flex-start;
    margin-left: 148px;
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
    margin-left: ${theme.spacing(0.5)};
  `,
});

export default AnnotationsField;
