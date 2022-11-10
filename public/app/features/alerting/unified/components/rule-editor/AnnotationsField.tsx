import { css, cx } from '@emotion/css';
import produce from 'immer';
import React, { useCallback, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Field, Input, InputControl, Label, Modal, TextArea, useStyles2 } from '@grafana/ui';

import { DashboardDTO } from '../../../../../types';
import { dashboardApi } from '../../api/alertingApi';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';

import { AnnotationKeyInput } from './AnnotationKeyInput';
import { DashboardPicker, PanelDTO } from './DashboardPicker';

const AnnotationsField = () => {
  const styles = useStyles2(getStyles);
  const [showPanelSelector, setShowPanelSelector] = useToggle(false);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardDTO | undefined>(undefined);

  const [selectedDashboardUid, setSelectedDashboardUid] = useState<string | undefined>(undefined);
  const [selectedPanelUid, setSelectedPanelUid] = useState<number | undefined>(undefined);

  const { useLazyDashboardQuery } = dashboardApi;
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

  const dashboardAnnotation = annotations.find((a) => a.key === Annotation.dashboardUID);
  const panelAnnotation = annotations.find((a) => a.key === Annotation.panelID);

  const dashboardUid = dashboardAnnotation?.value;
  const panelId = Number(panelAnnotation?.value);

  const [fetchDashboard] = useLazyDashboardQuery();
  const currentPanel: PanelDTO | undefined = currentDashboard?.dashboard?.panels?.find((p) => p.id === panelId);

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  const onDashboardPanelChange = () => {
    if (!selectedDashboardUid || !selectedPanelUid) {
      return;
    }

    const updatedAnnotations = produce(annotations, (draft) => {
      const dashboardAnn = draft.find((a) => a.key === Annotation.dashboardUID);
      const panelAnn = draft.find((a) => a.key === Annotation.panelID);

      if (dashboardAnn) {
        dashboardAnn.value = selectedDashboardUid;
      } else {
        draft.push({ key: Annotation.dashboardUID, value: selectedDashboardUid });
      }

      if (panelAnn) {
        panelAnn.value = selectedPanelUid.toString(10);
      } else {
        draft.push({ key: Annotation.panelID, value: selectedPanelUid.toString(10) });
      }
    });

    setValue('annotations', updatedAnnotations);
    setShowPanelSelector(false);
    setSelectedDashboardUid(undefined);
    setSelectedPanelUid(undefined);
    setCurrentDashboard(undefined);
  };

  const openDashboardPicker = async () => {
    setShowPanelSelector(true);
    if (dashboardUid) {
      const { data } = await fetchDashboard({ uid: dashboardUid }, true);
      if (data) {
        setCurrentDashboard(data);
      }
    }
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
          <Button type="button" variant="secondary" icon="dashboard" onClick={openDashboardPicker}>
            Set dashboard and panel
          </Button>
        </Stack>
        <Modal
          title="Select dashboard and panel"
          closeOnEscape
          isOpen={showPanelSelector}
          onDismiss={setShowPanelSelector}
          className={styles.modal}
          contentClassName={styles.modalContent}
        >
          {currentDashboard && (
            <Alert
              title="Current selection"
              severity="info"
              topSpacing={0}
              bottomSpacing={1}
              className={styles.modalAlert}
            >
              <div>
                Dashboard: {currentDashboard.dashboard.title} ({currentDashboard.dashboard.uid})
              </div>
              {!!currentPanel && (
                <div>
                  Panel: {currentPanel.title} ({currentPanel.id})
                </div>
              )}
            </Alert>
          )}
          <DashboardPicker
            dashboardUid={selectedDashboardUid}
            panelId={selectedPanelUid}
            onDashboardChange={setSelectedDashboardUid}
            onPanelChange={setSelectedPanelUid}
          />
          <Modal.ButtonRow>
            <Button
              type="button"
              variant="primary"
              disabled={!selectedDashboardUid || !selectedPanelUid}
              onClick={onDashboardPanelChange}
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

const getStyles = (theme: GrafanaTheme2) => ({
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
  modal: css`
    height: 100%;
  `,
  modalContent: css`
    flex: 1;
    display: flex;
    flex-direction: column;
  `,
  modalAlert: css`
    flex-grow: 0;
  `,
});

export default AnnotationsField;
