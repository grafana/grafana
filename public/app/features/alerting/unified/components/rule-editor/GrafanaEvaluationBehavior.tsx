import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { RegisterOptions, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Card, Field, InlineLabel, Input, InputControl, useStyles2 } from '@grafana/ui';
import { RulerRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { logInfo, LogMessages } from '../../Analytics';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RuleForm, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { EditCloudGroupModal } from '../rules/EditRuleGroupModal';

import { MINUTE } from './AlertRuleForm';
import { FolderAndGroup, useGetGroupOptionsFromFolder } from './FolderAndGroup';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';

export const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds

export const getIntervalForGroup = (
  rulerRules: RulerRulesConfigDTO | null | undefined,
  group: string,
  folder: string
) => {
  const folderObj: Array<RulerRuleGroupDTO<RulerRuleDTO>> = rulerRules ? rulerRules[folder] : [];
  const groupObj = folderObj?.find((rule) => rule.name === group);

  const interval = groupObj?.interval ?? MINUTE;
  return interval;
};

const forValidationOptions = (evaluateEvery: string): RegisterOptions => ({
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (value: string) => {
    // parsePrometheusDuration does not allow 0 but does allow 0s
    if (value === '0') {
      return true;
    }

    try {
      const millisFor = parsePrometheusDuration(value);

      // 0 is a special value meaning for equals evaluation interval
      if (millisFor === 0) {
        return true;
      }

      try {
        const millisEvery = parsePrometheusDuration(evaluateEvery);
        return millisFor >= millisEvery
          ? true
          : 'For duration must be greater than or equal to the evaluation interval.';
      } catch (err) {
        // if we fail to parse "every", assume validation is successful, or the error messages
        // will overlap in the UI
        return true;
      }
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
});

const useIsNewGroup = (folder: string, group: string) => {
  const { groupOptions } = useGetGroupOptionsFromFolder(folder);

  const groupIsInGroupOptions = useCallback(
    (group_: string) => groupOptions.some((groupInList: SelectableValue<string>) => groupInList.label === group_),
    [groupOptions]
  );
  return !groupIsInGroupOptions(group);
};

function FolderGroupAndEvaluationInterval({
  initialFolder,
  evaluateEvery,
  setEvaluateEvery,
}: {
  initialFolder: RuleForm | null;
  evaluateEvery: string;
  setEvaluateEvery: (value: string) => void;
}) {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();
  const [isEditingGroup, setIsEditingGroup] = useState(false);

  const group = watch('group');
  const folder = watch('folder');

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const isNewGroup = useIsNewGroup(folder?.title ?? '', group);

  useEffect(() => {
    group &&
      folder &&
      setEvaluateEvery(getIntervalForGroup(groupfoldersForGrafana?.result, group, folder?.title ?? ''));
  }, [group, folder, groupfoldersForGrafana?.result, setEvaluateEvery]);

  const closeEditGroupModal = (saved = false) => {
    if (!saved) {
      logInfo(LogMessages.leavingRuleGroupEdit);
    }
    setIsEditingGroup(false);
  };

  const onOpenEditGroupModal = () => setIsEditingGroup(true);

  const editGroupDisabled = groupfoldersForGrafana?.loading || isNewGroup || !folder || !group;

  return (
    <div>
      <FolderAndGroup initialFolder={initialFolder} />
      {isEditingGroup && (
        <EditCloudGroupModal
          groupInterval={evaluateEvery}
          nameSpaceAndGroup={{ namespace: folder?.title ?? '', group: group }}
          sourceName={GRAFANA_RULES_SOURCE_NAME}
          onClose={() => closeEditGroupModal()}
          folderAndGroupReadOnly
        />
      )}
      {folder && group && (
        <Card className={styles.cardContainer}>
          <Card.Heading>Evaluation behavior</Card.Heading>
          <Card.Meta>
            <Stack direction="column">
              <div className={styles.evaluateLabel}>
                {`Alert rules in the `} <span className={styles.bold}>{group}</span> group are evaluated every{' '}
                <span className={styles.bold}>{evaluateEvery}</span>.
              </div>

              <br />
              {!isNewGroup && (
                <div>
                  {`Evaluation group interval applies to every rule within a group. It overwrites intervals defined for existing alert rules.`}
                </div>
              )}
              <br />
            </Stack>
          </Card.Meta>
          <Card.Actions>
            <Stack direction="row" justify-content="right" align-items="center">
              {isNewGroup && (
                <div className={styles.warningMessage}>
                  {`To edit the evaluation group interval, save the alert rule.`}
                </div>
              )}
              <Button
                icon={'edit'}
                type="button"
                variant="secondary"
                disabled={editGroupDisabled}
                onClick={onOpenEditGroupModal}
              >
                <span>{'Edit evaluation group'}</span>
              </Button>
            </Stack>
          </Card.Actions>
        </Card>
      )}
    </div>
  );
}

function ForInput({ evaluateEvery }: { evaluateEvery: string }) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const evaluateForId = 'eval-for-input';

  return (
    <Stack direction="row" justify-content="flex-start" align-items="flex-start">
      <InlineLabel
        htmlFor={evaluateForId}
        width={7}
        tooltip='Once the condition is breached, the alert goes into pending state. If the alert is pending longer than the "for" value, it becomes a firing alert.'
      >
        for
      </InlineLabel>
      <Field
        className={styles.inlineField}
        error={errors.evaluateFor?.message}
        invalid={!!errors.evaluateFor?.message}
        validationMessageHorizontalOverflow={true}
      >
        <Input id={evaluateForId} width={8} {...register('evaluateFor', forValidationOptions(evaluateEvery))} />
      </Field>
    </Stack>
  );
}

export function GrafanaEvaluationBehavior({
  initialFolder,
  evaluateEvery,
  setEvaluateEvery,
}: {
  initialFolder: RuleForm | null;
  evaluateEvery: string;
  setEvaluateEvery: (value: string) => void;
}) {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);

  return (
    // TODO remove "and alert condition" for recording rules
    <RuleEditorSection stepNo={3} title="Alert evaluation behavior">
      <Stack direction="column" justify-content="flex-start" align-items="flex-start">
        <FolderGroupAndEvaluationInterval
          initialFolder={initialFolder}
          setEvaluateEvery={setEvaluateEvery}
          evaluateEvery={evaluateEvery}
        />
        <ForInput evaluateEvery={evaluateEvery} />
      </Stack>
      <CollapseToggle
        isCollapsed={!showErrorHandling}
        onToggle={(collapsed) => setShowErrorHandling(!collapsed)}
        text="Configure no data and error handling"
        className={styles.collapseToggle}
      />
      {showErrorHandling && (
        <>
          <Field htmlFor="no-data-state-input" label="Alert state if no data or all values are null">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <GrafanaAlertStatePicker
                  {...field}
                  inputId="no-data-state-input"
                  width={42}
                  includeNoData={true}
                  includeError={false}
                  onChange={(value) => onChange(value?.value)}
                />
              )}
              name="noDataState"
            />
          </Field>
          <Field htmlFor="exec-err-state-input" label="Alert state if execution error or timeout">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <GrafanaAlertStatePicker
                  {...field}
                  inputId="exec-err-state-input"
                  width={42}
                  includeNoData={false}
                  includeError={true}
                  onChange={(value) => onChange(value?.value)}
                />
              )}
              name="execErrState"
            />
          </Field>
        </>
      )}
    </RuleEditorSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlineField: css`
    margin-bottom: 0;
  `,
  collapseToggle: css`
    margin: ${theme.spacing(2, 0, 2, -1)};
  `,
  evaluateLabel: css`
    align-self: left;
    margin-right: ${theme.spacing(1)};
  `,
  cardContainer: css`
    max-width: ${theme.breakpoints.values.sm}px;
  `,
  intervalChangedLabel: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  warningIcon: css`
    justify-self: center;
    margin-right: ${theme.spacing(1)};
    color: ${theme.colors.warning.text};
  `,
  warningMessage: css`
    color: ${theme.colors.warning.text};
  `,
  bold: css`
    font-weight: bold;
  `,
});
