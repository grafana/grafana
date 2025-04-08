import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, RegisterOptions, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Box,
  Button,
  Divider,
  Field,
  Icon,
  Input,
  Label,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { evaluateEveryValidationOptions } from '../../group-details/validation';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../rule-editor/formDefaults';
import { RuleFormValues } from '../../types/rule-form';
import {
  isGrafanaAlertingRuleByType,
  isGrafanaManagedRuleByType,
  isGrafanaRecordingRuleByType,
  isProvisionedRuleGroup,
} from '../../utils/rules';
import { parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { ProvisioningBadge } from '../Provisioning';

import { DurationQuickPick } from './DurationQuickPick';
import { EvaluationGroupQuickPick } from './EvaluationGroupQuickPick';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';

export const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds
export const MAX_GROUP_RESULTS = 1000;

const useFetchGroupsForFolder = (folderUid: string) => {
  // fetch the ruler rules from the database so we can figure out what other "groups" are already defined
  // for our folders
  return alertRuleApi.endpoints.rulerNamespace.useQuery(
    {
      namespace: folderUid,
      rulerConfig: GRAFANA_RULER_CONFIG,
    },
    {
      refetchOnMountOrArgChange: true,
      skip: !folderUid,
    }
  );
};

const namespaceToGroupOptions = (rulerNamespace: RulerRulesConfigDTO, enableProvisionedGroups: boolean) => {
  const folderGroups = Object.values(rulerNamespace).flat();

  return folderGroups
    .map<SelectableValue<string>>((group) => {
      const isProvisioned = isProvisionedRuleGroup(group);
      return {
        label: group.name,
        value: group.name,
        description: group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
        // we include provisioned folders, but disable the option to select them
        isDisabled: !enableProvisionedGroups ? isProvisioned : false,
        isProvisioned: isProvisioned,
      };
    })

    .sort(sortByLabel);
};

const sortByLabel = (a: SelectableValue<string>, b: SelectableValue<string>) => {
  return a.label?.localeCompare(b.label ?? '') || 0;
};

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
              'alerting.rule-form.evaluation-behaviour-for.validation',
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
        : t('alerting.rule-form.evaluation-behaviour-for.error-parsing', 'Failed to parse duration');
    }
  },
});

export function GrafanaEvaluationBehaviorStep({
  existing,
  enableProvisionedGroups,
}: {
  existing: boolean;
  enableProvisionedGroups: boolean;
}) {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);

  const {
    watch,
    setValue,
    getValues,
    formState: { errors },
    control,
    register,
  } = useFormContext<RuleFormValues>();

  const [group, type, isPaused, folder, evaluateEvery] = watch([
    'group',
    'type',
    'isPaused',
    'folder',
    'evaluateEvery',
    'keepFiringFor',
  ]);

  const isGrafanaAlertingRule = isGrafanaAlertingRuleByType(type);
  const isGrafanaRecordingRule = isGrafanaRecordingRuleByType(type);
  const { currentData: rulerNamespace, isLoading: loadingGroups } = useFetchGroupsForFolder(folder?.uid ?? '');

  const groupOptions = useMemo(() => {
    return rulerNamespace ? namespaceToGroupOptions(rulerNamespace, enableProvisionedGroups) : [];
  }, [enableProvisionedGroups, rulerNamespace]);

  const existingGroup = Object.values(rulerNamespace ?? {})
    .flat()
    .find((ruleGroup) => ruleGroup.name === group);

  // synchronize the evaluation interval with the group name when it's an existing group
  useEffect(() => {
    if (existingGroup) {
      setValue('evaluateEvery', existingGroup.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL);
    }
  }, [existingGroup, setValue]);

  const [isCreatingEvaluationGroup, setIsCreatingEvaluationGroup] = useState(false);

  const handleEvalGroupCreation = (groupName: string, evaluationInterval: string) => {
    setValue('group', groupName);
    setValue('evaluateEvery', evaluationInterval);
    setIsCreatingEvaluationGroup(false);
  };

  const defaultGroupValue = group ? { value: group, label: group } : undefined;

  const pauseContentText = isGrafanaRecordingRule
    ? t('alerting.rule-form.evaluation.pause.recording', 'Turn on to pause evaluation for this recording rule.')
    : t('alerting.rule-form.evaluation.pause.alerting', 'Turn on to pause evaluation for this alert rule.');

  const onOpenEvaluationGroupCreationModal = () => setIsCreatingEvaluationGroup(true);

  const step = isGrafanaManagedRuleByType(type) ? 4 : 3;
  const label =
    isGrafanaManagedRuleByType(type) && !folder?.uid
      ? t(
          'alerting.rule-form.evaluation.select-folder-before',
          'Select a folder before setting evaluation group and interval'
        )
      : t('alerting.rule-form.evaluation.evaluation-group-and-interval', 'Evaluation group and interval');

  return (
    // TODO remove "and alert condition" for recording rules
    <RuleEditorSection
      stepNo={step}
      title={t('alerting.grafana-evaluation-behavior-step.title-set-evaluation-behavior', 'Set evaluation behavior')}
      description={getDescription(isGrafanaRecordingRule)}
    >
      <Stack direction="column" justify-content="flex-start" align-items="flex-start">
        <Stack alignItems="center">
          <div style={{ width: 420 }}>
            <Field
              label={label}
              data-testid="group-picker"
              className={styles.formInput}
              error={errors.group?.message}
              invalid={!!errors.group?.message}
              htmlFor="group"
            >
              <Controller
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Select
                    disabled={!folder?.uid || loadingGroups}
                    inputId="group"
                    key={uniqueId()}
                    {...field}
                    onChange={(group) => {
                      field.onChange(group.label ?? '');
                    }}
                    isLoading={loadingGroups}
                    invalid={Boolean(folder?.uid) && !group && Boolean(fieldState.error)}
                    cacheOptions
                    loadingMessage={'Loading groups...'}
                    defaultValue={defaultGroupValue}
                    options={groupOptions}
                    getOptionLabel={(option: SelectableValue<string>) => (
                      <div>
                        <span>{option.label}</span>
                        {option.isProvisioned && (
                          <>
                            {' '}
                            <ProvisioningBadge />
                          </>
                        )}
                      </div>
                    )}
                    placeholder={'Select an evaluation group...'}
                  />
                )}
                name="group"
                control={control}
                rules={{
                  required: { value: true, message: 'Must enter a group name' },
                }}
              />
            </Field>
          </div>
          <Box gap={1} display={'flex'} alignItems={'center'}>
            <Text color="secondary">
              <Trans i18nKey="alerting.grafana-evaluation-behavior-step.or">or</Trans>
            </Text>
            <Button
              onClick={onOpenEvaluationGroupCreationModal}
              type="button"
              icon="plus"
              fill="outline"
              variant="secondary"
              disabled={!folder?.uid}
              data-testid={selectors.components.AlertRules.newEvaluationGroupButton}
            >
              <Trans i18nKey="alerting.rule-form.evaluation.new-group">New evaluation group</Trans>
            </Button>
          </Box>
          {isCreatingEvaluationGroup && (
            <EvaluationGroupCreationModal
              onCreate={handleEvalGroupCreation}
              onClose={() => setIsCreatingEvaluationGroup(false)}
              groupfoldersForGrafana={rulerNamespace}
            />
          )}
        </Stack>

        {folder?.title && group && (
          <div className={styles.evaluationContainer}>
            <Stack direction="column" gap={0}>
              <div className={styles.marginTop}>
                <Stack direction="column" gap={1}>
                  {getValues('group') && getValues('evaluateEvery') && (
                    <Trans i18nKey="alerting.rule-form.evaluation.group-text" values={{ evaluateEvery }}>
                      All rules in the selected group are evaluated every {{ evaluateEvery }}.
                    </Trans>
                  )}
                </Stack>
              </div>
            </Stack>
          </div>
        )}
        {/* Show the pending period input only for Grafana alerting rules */}
        {isGrafanaAlertingRule && <ForInput evaluateEvery={evaluateEvery} />}
        <Divider />
        {/*Show the keepFiringFor input only for Grafana alerting rules*/}
        {isGrafanaAlertingRule && <KeepFiringFor evaluateEvery={evaluateEvery} />}

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
                    <Trans i18nKey="alerting.rule-form.pause.label">Pause evaluation</Trans>
                    <Tooltip placement="top" content={pauseContentText} theme={'info'}>
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
            text={t(
              'alerting.grafana-evaluation-behavior-step.text-configure-no-data-and-error-handling',
              'Configure no data and error handling'
            )}
          />
          {showErrorHandling && (
            <>
              <NeedHelpInfoForConfigureNoDataError />
              <Field
                htmlFor="no-data-state-input"
                label={t('alerting.alert.state-no-data', 'Alert state if no data or all values are null')}
              >
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
              <Field
                htmlFor="exec-err-state-input"
                label={t('alerting.alert.state-error-timeout', 'Alert state if execution error or timeout')}
              >
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
              <Field
                label={t('alerting.alert.missing-series-resolve', 'Missing series evaluations to resolve')}
                description={t(
                  'alerting.alert.description-missing-series-evaluations',
                  'How many consecutive evaluation intervals with no data for a dimension must pass before the alert state is considered stale and automatically resolved. If no value is provided, the value will default to 2.'
                )}
                invalid={!!errors.missingSeriesEvalsToResolve?.message}
                error={errors.missingSeriesEvalsToResolve?.message}
                className={styles.inlineField}
                htmlFor="missing-series-resolve"
              >
                <Input
                  placeholder={t(
                    'alerting.grafana-evaluation-behavior-step.missing-series-resolve-placeholder',
                    'Default: 2'
                  )}
                  id="missing-series-resolve"
                  {...register('missingSeriesEvalsToResolve', {
                    pattern: { value: /^\d+$/, message: 'Must be a positive integer.' },
                  })}
                  width={21}
                />
              </Field>
            </>
          )}
        </>
      )}
    </RuleEditorSection>
  );
}

function EvaluationGroupCreationModal({
  onClose,
  onCreate,
  groupfoldersForGrafana,
}: {
  onClose: () => void;
  onCreate: (group: string, evaluationInterval: string) => void;
  groupfoldersForGrafana?: RulerRulesConfigDTO | null;
}): React.ReactElement {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();

  const evaluateEveryId = 'eval-every-input';
  const evaluationGroupNameId = 'new-eval-group-name';
  const [groupName, folderName, type] = watch(['group', 'folder.title', 'type']);
  const isGrafanaRecordingRule = type ? isGrafanaRecordingRuleByType(type) : false;

  const formAPI = useForm({
    defaultValues: { group: '', evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL },
    mode: 'onChange',
    shouldFocusError: true,
  });

  const { register, handleSubmit, formState, setValue, getValues, watch: watchGroupFormValues } = formAPI;
  const evaluationInterval = watchGroupFormValues('evaluateEvery');

  const groupRules =
    (groupfoldersForGrafana && groupfoldersForGrafana[folderName]?.find((g) => g.name === groupName)?.rules) ?? [];

  const onSubmit = () => {
    onCreate(getValues('group'), getValues('evaluateEvery'));
  };

  const onCancel = () => {
    onClose();
  };

  const setEvaluationInterval = (interval: string) => {
    setValue('evaluateEvery', interval, { shouldValidate: true });
  };

  const modalTitle = isGrafanaRecordingRule
    ? t(
        'alerting.folderAndGroup.evaluation.modal.text.recording',
        'Create a new evaluation group to use for this recording rule.'
      )
    : t(
        'alerting.folderAndGroup.evaluation.modal.text.alerting',
        'Create a new evaluation group to use for this alert rule.'
      );

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={'New evaluation group'}
      onDismiss={onCancel}
      onClickBackdrop={onCancel}
    >
      <div className={styles.modalTitle}>{modalTitle}</div>

      <FormProvider {...formAPI}>
        <form onSubmit={handleSubmit(() => onSubmit())}>
          <Field
            label={
              <Label
                htmlFor={evaluationGroupNameId}
                description="A group evaluates all its rules over the same evaluation interval."
              >
                <Trans i18nKey="alerting.rule-form.evaluation.group-name">Evaluation group name</Trans>
              </Label>
            }
            error={formState.errors.group?.message}
            invalid={Boolean(formState.errors.group)}
          >
            <Input
              data-testid={selectors.components.AlertRules.newEvaluationGroupName}
              className={styles.formInput}
              autoFocus={true}
              id={evaluationGroupNameId}
              placeholder={t('alerting.evaluation-group-creation-modal.placeholder-enter-a-name', 'Enter a name')}
              {...register('group', { required: { value: true, message: 'Required.' } })}
            />
          </Field>

          <Field
            error={formState.errors.evaluateEvery?.message}
            label={
              <Label
                htmlFor={evaluateEveryId}
                description={t(
                  'alerting.evaluation-group-creation-modal.description-often-rules-group-evaluated',
                  'How often all rules in the group are evaluated.'
                )}
              >
                <Trans i18nKey="alerting.rule-form.evaluation.group.interval">Evaluation interval</Trans>
              </Label>
            }
            invalid={Boolean(formState.errors.evaluateEvery)}
          >
            <Input
              data-testid={selectors.components.AlertRules.newEvaluationGroupInterval}
              className={styles.formInput}
              id={evaluateEveryId}
              placeholder={DEFAULT_GROUP_EVALUATION_INTERVAL}
              {...register(
                'evaluateEvery',
                evaluateEveryValidationOptions<{ group: string; evaluateEvery: string }>(groupRules)
              )}
            />
          </Field>

          <EvaluationGroupQuickPick currentInterval={evaluationInterval} onSelect={setEvaluationInterval} />

          <Modal.ButtonRow>
            <Button variant="secondary" type="button" onClick={onCancel}>
              <Trans i18nKey="alerting.rule-form.evaluation.group.cancel">Cancel</Trans>
            </Button>
            <Button
              type="submit"
              disabled={!formState.isValid}
              data-testid={selectors.components.AlertRules.newEvaluationGroupCreate}
            >
              <Trans i18nKey="alerting.rule-form.evaluation.group.create">Create</Trans>
            </Button>
          </Modal.ButtonRow>
        </form>
      </FormProvider>
    </Modal>
  );
}

export function ForInput({ evaluateEvery }: { evaluateEvery: string }) {
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
    <Stack direction="column" justify-content="flex-start" align-items="flex-start">
      <Field
        label={
          <Label
            htmlFor={evaluateForId}
            description='Period during which the threshold condition must be met to trigger an alert. Selecting "None" triggers the alert immediately once the condition is met.'
          >
            <Trans i18nKey="alerting.rule-form.evaluation-behaviour.pending-period">Pending period</Trans>
          </Label>
        }
        className={styles.inlineField}
        error={errors.evaluateFor?.message}
        invalid={Boolean(errors.evaluateFor?.message) ? true : undefined}
        validationMessageHorizontalOverflow={true}
      >
        <Input id={evaluateForId} width={8} {...register('evaluateFor', forValidationOptions(evaluateEvery))} />
      </Field>
      <DurationQuickPick
        selectedDuration={currentPendingPeriod}
        groupEvaluationInterval={evaluateEvery}
        onSelect={setPendingPeriod}
      />
    </Stack>
  );
}

function KeepFiringFor({ evaluateEvery }: { evaluateEvery: string }) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<RuleFormValues>();

  const currentKeepFiringFor = watch('keepFiringFor');
  const keepFiringForId = 'keep-firing-for-input';

  const setKeepFiringFor = (keepFiringFor: string) => {
    setValue('keepFiringFor', keepFiringFor);
  };

  return (
    <Stack direction="column" justify-content="flex-start" align-items="flex-start">
      <Field
        label={
          <Label
            htmlFor={keepFiringForId}
            description={t(
              'alerting.rule-form.evaluation-behaviour.keep-firing-for.label-description',
              'Period during which the alert will continue to show up as firing even though the threshold condition is no longer breached. Selecting "None" means the alert will be back to normal immediately.'
            )}
          >
            <Trans i18nKey="alerting.rule-form.evaluation-behaviour.keep-firing-for.label-text">Keep firing for</Trans>
          </Label>
        }
        className={styles.inlineField}
        error={errors.keepFiringFor?.message}
        invalid={Boolean(errors.keepFiringFor?.message) ? true : undefined}
        validationMessageHorizontalOverflow={true}
      >
        <Input id={keepFiringForId} width={8} {...register('keepFiringFor')} />
      </Field>
      <DurationQuickPick
        selectedDuration={currentKeepFiringFor}
        groupEvaluationInterval={evaluateEvery}
        onSelect={setKeepFiringFor}
      />
    </Stack>
  );
}

function NeedHelpInfoForConfigureNoDataError() {
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling';

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.rule-form.evaluation-behaviour.info-help.text">
          Define the alert behavior when the evaluation fails or the query returns no data.
        </Trans>
      </Text>
      <NeedHelpInfo
        contentText={t(
          'alerting.rule-form.evaluation-behaviour.info-help.content',
          'These settings can help mitigate temporary data source issues, preventing alerts from unintentionally firing due to lack of data, errors, or timeouts.'
        )}
        externalLink={docsLink}
        linkText={t('alerting.rule-form.evaluation-behaviour.info-help.link-text', `Read more about this option`)}
        title={t(
          'alerting.rule-form.evaluation-behaviour.info-help.link-title',
          'Configure no data and error handling'
        )}
      />
    </Stack>
  );
}

function getDescription(isGrafanaRecordingRule: boolean) {
  const docsLink = 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/';

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary">
        {isGrafanaRecordingRule ? (
          <Trans i18nKey="alerting.alert-recording-rule-form.evaluation-behaviour.description.text">
            Define how the recording rule is evaluated.
          </Trans>
        ) : (
          <Trans i18nKey="alerting.rule-form.evaluation-behaviour.description.text">
            Define how the alert rule is evaluated.
          </Trans>
        )}
      </Text>
      <NeedHelpInfo
        contentText={
          <>
            <p>
              <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description1">
                Evaluation groups are containers for evaluating alert and recording rules.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description2">
                An evaluation group defines an evaluation interval - how often a rule is evaluated. Alert rules within
                the same evaluation group are evaluated over the same evaluation interval.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description3">
                Pending period specifies how long the threshold condition must be met before the alert starts firing.
                This option helps prevent alerts from being triggered by temporary issues.
              </Trans>
            </p>
          </>
        }
        externalLink={docsLink}
        linkText={t(
          'alerting.rule-form.evaluation-behaviour.info-help2.link-text',
          `Read about evaluation and alert states`
        )}
        title={t('alerting.rule-form.evaluation-behaviour.info-help2.link-title', 'Alert rule evaluation')}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlineField: css({
    marginBottom: 0,
  }),
  evaluationContainer: css({
    color: theme.colors.text.secondary,
    maxWidth: `${theme.breakpoints.values.sm}px`,
    fontSize: theme.typography.size.sm,
  }),
  infoIcon: css({
    marginLeft: '10px',
  }),
  marginTop: css({
    marginTop: theme.spacing(1),
  }),
  switchLabel: css({
    color: theme.colors.text.primary,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  formInput: css({
    flexGrow: 1,
  }),
  modal: css({
    width: `${theme.breakpoints.values.sm}px`,
  }),
  modalTitle: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
