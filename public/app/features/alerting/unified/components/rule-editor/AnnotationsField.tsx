import { css, cx } from '@emotion/css';
import produce from 'immer';
import React, { useCallback, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, Input, InputControl, Label, Modal, TextArea, useStyles } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';

import { AnnotationKeyInput } from './AnnotationKeyInput';
import { DashboardPicker } from './DashboardPicker';

const AnnotationsField = () => {
  const styles = useStyles(getStyles);
  const [showPanelSelector, setShowPanelSelector] = useToggle(false);
  const [selectedDashboard, setSelectedDashboard] = useState<string | undefined>(undefined);
  const [selectedPanel, setSelectedPanel] = useState<number | undefined>(undefined);

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

  const onPanelChange = () => {
    if (!selectedDashboard || !selectedPanel) {
      return;
    }

    const updatedAnnotations = produce(annotations, (draft) => {
      const dashboardAnn = draft.find((a) => a.key === Annotation.dashboardUID);
      const panelAnn = draft.find((a) => a.key === Annotation.panelID);

      if (dashboardAnn) {
        dashboardAnn.value = selectedDashboard;
      } else {
        draft.push({ key: Annotation.dashboardUID, value: selectedDashboard });
      }

      if (panelAnn) {
        panelAnn.value = selectedPanel.toString(10);
      } else {
        draft.push({ key: Annotation.panelID, value: selectedPanel.toString(10) });
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
            Add new annotation
          </Button>
          <Button type="button" variant="secondary" icon="dashboard" onClick={setShowPanelSelector}>
            Set panel and dashboard
          </Button>
        </Stack>
        <Modal
          title="Select dashboard and panel"
          closeOnEscape
          isOpen={showPanelSelector}
          onDismiss={setShowPanelSelector}
        >
          <DashboardPicker
            dashboardUid={selectedDashboard}
            panelId={selectedPanel}
            onDashboardChange={setSelectedDashboard}
            onPanelChange={setSelectedPanel}
          />
          <Modal.ButtonRow>
            <Button
              type="button"
              variant="primary"
              disabled={!selectedDashboard && !selectedPanel}
              onClick={onPanelChange}
            >
              Confirm
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowPanelSelector(false)}>
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  annotationValueInput: css`
    width: 426px;
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
    margin-bottom: ${theme.spacing.xs};
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
  flexRowItemMargin: css`
    margin-left: ${theme.spacing.xs};
  `,
});

export default AnnotationsField;
