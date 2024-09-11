import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { Controller, RegisterOptions, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Icon, IconButton, Input, Label, Stack, Switch, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { isGrafanaAlertingRuleByType } from 'app/features/alerting/unified/utils/rules';

import { CombinedRuleGroup, CombinedRuleNamespace } from '../../../../../types/unified-alerting';
import { LogMessages, logInfo } from '../../Analytics';
import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { EditCloudGroupModal } from '../rules/EditRuleGroupModal';

import { FolderAndGroup, useFolderGroupOptions } from './FolderAndGroup';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { NeedHelpInfo } from './NeedHelpInfo';
import { PendingPeriodQuickPick } from './PendingPeriodQuickPick';
import { RuleEditorSection } from './RuleEditorSection';

export const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds

const forValidationOptions = (evaluateEvery: string): RegisterOptions<{ evaluateFor: string }> => ({
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (value) => {
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
          : t(
              'alert-rule-form.evaluation-behaviour-for.validation',
              'Pending period must be greater than or equal to the evaluation interval.'
            );
      } catch (err) {
        // if we fail to parse "every", assume validation is successful, or the error messages
        // will overlap in the UI
        return true;
      }
    } catch (error) {
      return error instanceof Error
        ? error.message
        : t('alert-rule-form.evaluation-behaviour-for.error-parsing', 'Failed to parse duration');
    }
  },
});

const useIsNewGroup = (folder: string, group: string) => {
  const { groupOptions } = useFolderGroupOptions(folder, false);

  const groupIsInGroupOptions = useCallback(
    (group_: string) => groupOptions.some((groupInList: SelectableValue<string>) => groupInList.label === group_),
    [groupOptions]
  );
  return !groupIsInGroupOptions(group);
};

function FolderGroupAndEvaluationInterval({
  evaluateEvery,
  setEvaluateEvery,
  enableProvisionedGroups,
}: {
  evaluateEvery: string;
  setEvaluateEvery: (value: string) => void;
  enableProvisionedGroups: boolean;
}) {
  const styles = useStyles2(getStyles);
  const { watch, setValue, getValues } = useFormContext<RuleFormValues>();
  const [isEditingGroup, setIsEditingGroup] = useState(false);

  const [groupName, folderUid, folderName] = watch(['group', 'folder.uid', 'folder.title']);

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const grafanaNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const existingNamespace = grafanaNamespaces.find((ns) => ns.uid === folderUid);
  const existingGroup = existingNamespace?.groups.find((g) => g.name === groupName);

  const isNewGroup = useIsNewGroup(folderUid ?? '', groupName);

  useEffect(() => {
    if (!isNewGroup && existingGroup?.interval) {
      setEvaluateEvery(existingGroup.interval);
    }
  }, [setEvaluateEvery, isNewGroup, setValue, existingGroup]);

  const closeEditGroupModal = (saved = false) => {
    if (!saved) {
      logInfo(LogMessages.leavingRuleGroupEdit);
    }
    setIsEditingGroup(false);
  };

  const onOpenEditGroupModal = () => setIsEditingGroup(true);

  const editGroupDisabled = groupfoldersForGrafana?.loading || isNewGroup || !folderUid || !groupName;

  const emptyNamespace: CombinedRuleNamespace = {
    name: folderName,
    rulesSource: GRAFANA_RULES_SOURCE_NAME,
    groups: [],
  };
  const emptyGroup: CombinedRuleGroup = { name: groupName, interval: evaluateEvery, rules: [], totals: {} };

  return (
    <div>
      <FolderAndGroup
        groupfoldersForGrafana={groupfoldersForGrafana?.result}
        enableProvisionedGroups={enableProvisionedGroups}
      />
      {folderName && isEditingGroup && (
        <EditCloudGroupModal
          namespace={existingNamespace ?? emptyNamespace}
          group={existingGroup ?? emptyGroup}
          folderUid={folderUid}
          onClose={() => closeEditGroupModal()}
          intervalEditOnly
          hideFolder={true}
        />
      )}
      {folderName && groupName && (
        <div className={styles.evaluationContainer}>
          <Stack direction="column" gap={0}>
            <div className={styles.marginTop}>
              <Stack direction="column" gap={1}>
                {getValues('group') && getValues('evaluateEvery') && (
                  <span>
                    <Trans i18nKey="alert-rule-form.evaluation-behaviour-group.text" values={{ evaluateEvery }}>
                      All rules in the selected group are evaluated every {{ evaluateEvery }}.
                    </Trans>
                    {!isNewGroup && (
                      <IconButton
                        name="pen"
                        aria-label="Edit"
                        disabled={editGroupDisabled}
                        onClick={onOpenEditGroupModal}
                      />
                    )}
                  </span>
                )}
              </Stack>
            </div>
          </Stack>
        </div>
      )}
    </div>
  );
}

function ForInput({ evaluateEvery }: { evaluateEvery: string }) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<RuleFormValues>();

  const evaluateForId = 'eval-for-input';
  const currentPendingPeriod = watch('evaluateFor');

  const setPendingPeriod = (pendingPeriod: string) => {
    setValue('evaluateFor', pendingPeriod);
  };

  return (
    <Stack direction="row" justify-content="flex-start" align-items="flex-start">
      <Field
        label={
          <Label
            htmlFor="evaluateFor"
            description='Period the threshold condition must be met to trigger the alert. Selecting "None" triggers the alert immediately once the condition is met.'
          >
            <Trans i18nKey="alert-rule-form.evaluation-behaviour.pending-period">Pending period</Trans>
          </Label>
        }
        className={styles.inlineField}
        error={errors.evaluateFor?.message}
        invalid={Boolean(errors.evaluateFor?.message) ? true : undefined}
        validationMessageHorizontalOverflow={true}
      >
        <Stack direction="row" alignItems="center">
          <Input id={evaluateForId} width={8} {...register('evaluateFor', forValidationOptions(evaluateEvery))} />
          <PendingPeriodQuickPick
            selectedPendingPeriod={currentPendingPeriod}
            groupEvaluationInterval={evaluateEvery}
            onSelect={setPendingPeriod}
          />
        </Stack>
      </Field>
    </Stack>
  );
}

function NeedHelpInfoForConfigureNoDataError() {
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling';

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alert-rule-form.evaluation-behaviour.info-help.text">
          Define the alert behavior when the evaluation fails or the query returns no data.
        </Trans>
      </Text>
      <NeedHelpInfo
        contentText="These settings can help mitigate temporary data source issues, preventing alerts from unintentionally firing due to lack of data, errors, or timeouts."
        externalLink={docsLink}
        linkText={`Read more about this option`}
        title="Configure no data and error handling"
      />
    </Stack>
  );
}

function getDescription() {
  const docsLink = 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/';

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alert-rule-form.evaluation-behaviour.description.text">
          Define how the alert rule is evaluated.
        </Trans>
      </Text>
      <NeedHelpInfo
        contentText={
          <>
            <p>
              <Trans i18nKey="alert-rule-form.evaluation-behaviour-description1">
                Evaluation groups are containers for evaluating alert and recording rules.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="alert-rule-form.evaluation-behaviour-description2">
                An evaluation group defines an evaluation interval - how often a rule is evaluated. Alert rules within
                the same evaluation group are evaluated over the same evaluation interval.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="alert-rule-form.evaluation-behaviour-description3">
                Pending period specifies how long the threshold condition must be met before the alert starts firing.
                This option helps prevent alerts from being triggered by temporary issues.
              </Trans>
            </p>
          </>
        }
        externalLink={docsLink}
        linkText={`Read about evaluation and alert states`}
        title="Alert rule evaluation"
      />
    </Stack>
  );
}

export function GrafanaEvaluationBehavior({
  evaluateEvery,
  setEvaluateEvery,
  existing,
  enableProvisionedGroups,
}: {
  evaluateEvery: string;
  setEvaluateEvery: (value: string) => void;
  existing: boolean;
  enableProvisionedGroups: boolean;
}) {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);

  const { watch, setValue } = useFormContext<RuleFormValues>();

  const isPaused = watch('isPaused');
  const type = watch('type');

  const isGrafanaAlertingRule = isGrafanaAlertingRuleByType(type);

  return (
    // TODO remove "and alert condition" for recording rules
    <RuleEditorSection stepNo={3} title="Set evaluation behavior" description={getDescription()}>
      <Stack direction="column" justify-content="flex-start" align-items="flex-start">
        <FolderGroupAndEvaluationInterval
          setEvaluateEvery={setEvaluateEvery}
          evaluateEvery={evaluateEvery}
          enableProvisionedGroups={enableProvisionedGroups}
        />
        {/* Show the pending period input only for Grafana alerting rules */}
        {isGrafanaAlertingRule && <ForInput evaluateEvery={evaluateEvery} />}

        {existing && (
          <Field htmlFor="pause-alert-switch">
            <Controller
              render={() => (
                <Stack gap={1} direction="row" alignItems="center">
                  <Switch
                    id="pause-alert"
                    onChange={(value) => {
                      setValue('isPaused', value.currentTarget.checked);
                    }}
                    value={Boolean(isPaused)}
                  />
                  <label htmlFor="pause-alert" className={styles.switchLabel}>
                    <Trans i18nKey="alert-rule-form.pause">Pause evaluation</Trans>
                    <Tooltip placement="top" content="Turn on to pause evaluation for this alert rule." theme={'info'}>
                      <Icon tabIndex={0} name="info-circle" size="sm" className={styles.infoIcon} />
                    </Tooltip>
                  </label>
                </Stack>
              )}
              name="isPaused"
            />
          </Field>
        )}
      </Stack>
      {isGrafanaAlertingRule && (
        <>
          <CollapseToggle
            isCollapsed={!showErrorHandling}
            onToggle={(collapsed) => setShowErrorHandling(!collapsed)}
            text="Configure no data and error handling"
          />
          {showErrorHandling && (
            <>
              <NeedHelpInfoForConfigureNoDataError />
              <Field htmlFor="no-data-state-input" label="Alert state if no data or all values are null">
                <Controller
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
                <Controller
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
        </>
      )}
    </RuleEditorSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlineField: css({
    marginBottom: 0,
  }),
  evaluateLabel: css({
    marginRight: theme.spacing(1),
  }),
  evaluationContainer: css({
    color: theme.colors.text.secondary,
    maxWidth: `${theme.breakpoints.values.sm}px`,
    fontSize: theme.typography.size.sm,
  }),
  intervalChangedLabel: css({
    marginBottom: theme.spacing(1),
  }),
  warningIcon: css({
    justifySelf: 'center',
    marginRight: theme.spacing(1),
    color: theme.colors.warning.text,
  }),
  infoIcon: css({
    marginLeft: '10px',
  }),
  warningMessage: css({
    color: theme.colors.warning.text,
  }),
  bold: css({
    fontWeight: 'bold',
  }),
  alignInterval: css({
    marginTop: theme.spacing(1),
    marginLeft: `-${theme.spacing(1)}`,
  }),
  marginTop: css({
    marginTop: theme.spacing(1),
  }),
  switchLabel: css({
    color: theme.colors.text.primary,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
