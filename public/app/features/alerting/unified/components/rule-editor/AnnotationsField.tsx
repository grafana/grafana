import { css, cx } from '@emotion/css';
import produce from 'immer';
import React, { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, Input, TextArea, useStyles2 } from '@grafana/ui';
import { DashboardDataDTO } from 'app/types';

import { dashboardApi } from '../../api/dashboardApi';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationLabels } from '../../utils/constants';

import AnnotationHeaderField from './AnnotationHeaderField';
import DashboardAnnotationField from './DashboardAnnotationField';
import { DashboardPicker, PanelDTO } from './DashboardPicker';

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

  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDataDTO | undefined>(undefined);
  const [selectedPanel, setSelectedPanel] = useState<PanelDTO | undefined>(undefined);

  const { useDashboardQuery } = dashboardApi;

  const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery(
    { uid: selectedDashboardUid ?? '' },
    { skip: !selectedDashboardUid }
  );

  useEffect(() => {
    if (isDashboardFetching) {
      return;
    }

    setSelectedDashboard(dashboardResult?.dashboard);
    const currentPanel = dashboardResult?.dashboard?.panels?.find((panel) => panel.id.toString() === selectedPanelId);
    setSelectedPanel(currentPanel);
  }, [selectedPanelId, dashboardResult, isDashboardFetching]);

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

  const handleDeleteDashboardAnnotation = () => {
    const updatedAnnotations = annotations.filter(
      (a) => a.key !== Annotation.dashboardUID && a.key !== Annotation.panelID
    );
    setValue('annotations', updatedAnnotations);
    setSelectedDashboard(undefined);
    setSelectedPanel(undefined);
  };

  const handleEditDashboardAnnotation = () => {
    setShowPanelSelector(true);
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
                <AnnotationHeaderField
                  annotationField={annotationField}
                  annotations={annotations}
                  annotation={annotation}
                  index={index}
                />
                {selectedDashboardUid && selectedPanelId && annotationField.key === Annotation.dashboardUID && (
                  <DashboardAnnotationField
                    dashboard={selectedDashboard}
                    panel={selectedPanel}
                    dashboardUid={selectedDashboardUid.toString()}
                    panelId={selectedPanelId.toString()}
                    onEditClick={handleEditDashboardAnnotation}
                    onDeleteClick={handleDeleteDashboardAnnotation}
                  />
                )}

                {
                  <div className={styles.annotationValueContainer}>
                    <Field
                      hidden={
                        annotationField.key === Annotation.dashboardUID || annotationField.key === Annotation.panelID
                      }
                      className={cx(styles.flexRowItemMargin, styles.field)}
                      invalid={!!errors.annotations?.[index]?.value?.message}
                      error={errors.annotations?.[index]?.value?.message}
                    >
                      <ValueInputComponent
                        data-testid={`annotation-value-${index}`}
                        className={cx(styles.annotationValueInput, { [styles.textarea]: !isUrl })}
                        {...register(`annotations.${index}.value`)}
                        placeholder={
                          isUrl
                            ? 'https://'
                            : (annotationField.key && `Enter a ${annotationField.key}...`) ||
                              'Enter custom annotation content...'
                        }
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
                }
              </div>
            </div>
          );
        })}
        <Stack direction="row" gap={1}>
          <div className={styles.addAnnotationsButtonContainer}>
            <Button
              icon="plus"
              type="button"
              variant="secondary"
              onClick={() => {
                append({ key: '', value: '' });
              }}
            >
              Add custom annotation
            </Button>
            {!selectedDashboard && (
              <Button type="button" variant="secondary" icon="dashboard" onClick={() => setShowPanelSelector(true)}>
                Link dashboard and panel
              </Button>
            )}
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
    margin-top: ${theme.spacing(2)};
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
    margin-top: 10px;
    margin-left: 10px;
  `,

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

  annotationValueContainer: css`
    display: flex;
  `,
});

export default AnnotationsField;
