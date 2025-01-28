import { css, cx } from '@emotion/css';
import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Input, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DashboardModel } from '../../../../dashboard/state/DashboardModel';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationLabels } from '../../utils/constants';
import { isGrafanaManagedRuleByType } from '../../utils/rules';

import AnnotationHeaderField from './AnnotationHeaderField';
import DashboardAnnotationField from './DashboardAnnotationField';
import { DashboardPicker, PanelDTO, getVisualPanels } from './DashboardPicker';
import { RuleEditorSection, RuleEditorSubSection } from './RuleEditorSection';
import { useDashboardQuery } from './useDashboardQuery';

const INPUT_WIDTH = 70;

const AnnotationsStep = () => {
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
  const type = watch('type');

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  const selectedDashboardUid = annotations.find((annotation) => annotation.key === Annotation.dashboardUID)?.value;
  const selectedPanelId = Number(annotations.find((annotation) => annotation.key === Annotation.panelID)?.value);

  const [selectedDashboard, setSelectedDashboard] = useState<DashboardModel | undefined>(undefined);
  const [selectedPanel, setSelectedPanel] = useState<PanelDTO | undefined>(undefined);

  const { dashboardModel, isFetching: isDashboardFetching } = useDashboardQuery(selectedDashboardUid);

  useEffect(() => {
    if (isDashboardFetching || !dashboardModel) {
      return;
    }

    setSelectedDashboard(dashboardModel);

    const allPanels = getVisualPanels(dashboardModel);
    const currentPanel = allPanels.find((panel) => panel.id === selectedPanelId);
    setSelectedPanel(currentPanel);
  }, [selectedPanelId, dashboardModel, isDashboardFetching]);

  const setSelectedDashboardAndPanelId = (dashboardUid: string, panelId: number) => {
    const updatedAnnotations = produce(annotations, (draft) => {
      const dashboardAnnotation = draft.find((a) => a.key === Annotation.dashboardUID);
      const panelAnnotation = draft.find((a) => a.key === Annotation.panelID);

      if (dashboardAnnotation) {
        dashboardAnnotation.value = dashboardUid;
      } else {
        draft.push({ key: Annotation.dashboardUID, value: dashboardUid });
      }

      if (panelAnnotation) {
        panelAnnotation.value = panelId.toString();
      } else {
        draft.push({ key: Annotation.panelID, value: panelId.toString() });
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

  // when using Grafana managed rules, the annotations step is the 6th step, as we have an additional step for the configure labels and notifications
  const step = isGrafanaManagedRuleByType(type) ? 6 : 5;

  return (
    <RuleEditorSection
      stepNo={step}
      title={t('alerting.annotations.title', 'Configure notification message')}
      description={t('alerting.annotations.description', 'Add more context to your alert notifications.')}
      helpInfo={{
        title: 'Annotations',
        contentText: `Annotations add metadata to provide more information on the alert in your alert notification messages.
        For example, add a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
        Annotations can contain a combination of text and template code.`,
      }}
      fullWidth
    >
      <RuleEditorSubSection>
        {fields.map((annotationField, index: number) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;
          // eslint-disable-next-line
          const annotation = annotationField.key as Annotation;
          const annotationError = errors.annotations?.[index]?.value?.message;

          return (
            <Stack key={annotationField.id} direction="column" alignItems="flex-start" gap={0.5}>
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
                    invalid={Boolean(annotationError)}
                    error={annotationError}
                    style={{ marginBottom: 0 }}
                  >
                    <ValueInputComponent
                      data-testid={`annotation-value-${index}`}
                      // Input uses (8 x width) but TextArea uses (1 x width) so we set both `width` and `className` with width.
                      width={INPUT_WIDTH}
                      className={cx({ [styles.textarea]: !isUrl })}
                      {...register(`annotations.${index}.value`)}
                      placeholder={
                        isUrl
                          ? 'https://'
                          : ((annotationField.key && `Enter a ${annotationField.key}`) ??
                            'Enter custom annotation content')
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
            </Stack>
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
      </RuleEditorSubSection>
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // @TODO ideally full width but 100% doesn't work, need to investigate why
  textarea: css({
    height: 76,
    width: theme.spacing(INPUT_WIDTH),
  }),
  addAnnotationsButtonContainer: css({
    marginTop: theme.spacing(1),
    gap: theme.spacing(1),
    display: 'flex',
  }),
  deleteAnnotationButton: css({
    display: 'inline-block',
    marginTop: '10px',
    marginLeft: '10px',
  }),
  annotationValueContainer: css({
    display: 'flex',
    marginTop: theme.spacing(0.5),
  }),
});

export default AnnotationsStep;
