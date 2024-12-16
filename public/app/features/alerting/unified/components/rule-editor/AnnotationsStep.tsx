import { css, cx } from '@emotion/css';
import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Input, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { DashboardModel } from '../../../../dashboard/state/DashboardModel';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation, annotationLabels } from '../../utils/constants';
import { isGrafanaManagedRuleByType } from '../../utils/rules';

import AnnotationHeaderField from './AnnotationHeaderField';
import DashboardAnnotationField from './DashboardAnnotationField';
import { DashboardPicker, PanelDTO, getVisualPanels } from './DashboardPicker';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { useDashboardQuery } from './useDashboardQuery';

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

  function getAnnotationsSectionDescription() {
    return (
      <Stack direction="row" gap={0.5} alignItems="center">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.annotations.description">Add more context to your alert notifications.</Trans>
        </Text>
        <NeedHelpInfo
          contentText={`Annotations add metadata to provide more information on the alert in your alert notification messages.
          For example, add a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
          Annotations can contain a combination of text and template code.`}
          title="Annotations"
        />
      </Stack>
    );
  }
  // when using Grafana managed rules, the annotations step is the 6th step, as we have an additional step for the configure labels and notifications
  const step = isGrafanaManagedRuleByType(type) ? 6 : 5;

  return (
    <RuleEditorSection
      stepNo={step}
      title={t('alerting.annotations.title', 'Configure notification message')}
      description={getAnnotationsSectionDescription()}
      fullWidth
    >
      <Stack direction="column" gap={1}>
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
      </Stack>
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annotationValueInput: css({
    width: '394px',
  }),
  textarea: css({
    height: '76px',
  }),
  addAnnotationsButtonContainer: css({
    marginTop: theme.spacing(1),
    gap: theme.spacing(1),
    display: 'flex',
  }),
  field: css({
    marginBottom: theme.spacing(0.5),
  }),
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  }),
  flexRowItemMargin: css({
    marginTop: theme.spacing(1),
  }),
  deleteAnnotationButton: css({
    display: 'inline-block',
    marginTop: '10px',
    marginLeft: '10px',
  }),

  annotationTitle: css({
    color: theme.colors.text.primary,
    marginBottom: '3px',
  }),

  annotationContainer: css({
    marginTop: '5px',
  }),

  annotationDescription: css({
    color: theme.colors.text.secondary,
  }),

  annotationValueContainer: css({
    display: 'flex',
  }),
});

export default AnnotationsStep;
