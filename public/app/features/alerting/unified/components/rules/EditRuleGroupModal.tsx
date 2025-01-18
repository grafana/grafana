import { css } from '@emotion/css';
import { compact } from 'lodash';
import { useMemo } from 'react';
import { FieldValues, FormProvider, RegisterOptions, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Badge, Button, Field, Input, Label, LinkButton, Modal, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import { CombinedRuleGroup, CombinedRuleNamespace, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import {
  useMoveRuleGroup,
  useRenameRuleGroup,
  useUpdateRuleGroupConfiguration,
} from '../../hooks/ruleGroup/useUpdateRuleGroup';
import { anyOfRequestState } from '../../hooks/useAsync';
import { fetchRulerRulesAction, rulesInSameGroupHaveInvalidFor } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { stringifyErrorLike } from '../../utils/misc';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../utils/rule-form';
import { AlertInfo, getAlertInfo, isGrafanaOrDataSourceRecordingRule } from '../../utils/rules';
import { formatPrometheusDuration, parsePrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';
import { decodeGrafanaNamespace, encodeGrafanaNamespace } from '../expressions/util';
import { EvaluationGroupQuickPick } from '../rule-editor/EvaluationGroupQuickPick';
import { MIN_TIME_RANGE_STEP_S } from '../rule-editor/GrafanaEvaluationBehavior';

const ITEMS_PER_PAGE = 10;

function ForBadge({ message, error }: { message: string; error?: boolean }) {
  if (error) {
    return <Badge color="red" icon="exclamation-circle" text={'Error'} tooltip={message} />;
  } else {
    return <Badge color="orange" icon="exclamation-triangle" text={'Unknown'} tooltip={message} />;
  }
}

const isValidEvaluation = (evaluation: string) => {
  try {
    const duration = parsePrometheusDuration(evaluation);

    if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
      return false;
    }

    if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

type AlertsWithForTableColumnProps = DynamicTableColumnProps<AlertInfo>;
type AlertsWithForTableProps = DynamicTableItemProps<AlertInfo>;

export const RulesForGroupTable = ({ rulesWithoutRecordingRules }: { rulesWithoutRecordingRules: RulerRuleDTO[] }) => {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<FormValues>();
  const currentInterval = watch('groupInterval');
  const unknownCurrentInterval = !Boolean(currentInterval);

  const rows: AlertsWithForTableProps[] = rulesWithoutRecordingRules
    .slice()
    .map((rule: RulerRuleDTO, index) => ({
      id: index,
      data: getAlertInfo(rule, currentInterval),
    }))
    .sort(
      (alert1, alert2) =>
        safeParsePrometheusDuration(alert1.data.forDuration ?? '') -
        safeParsePrometheusDuration(alert2.data.forDuration ?? '')
    );

  const columns: AlertsWithForTableColumnProps[] = useMemo(() => {
    return [
      {
        id: 'alertName',
        label: 'Alert',
        renderCell: ({ data: { alertName } }) => {
          return <>{alertName}</>;
        },
        size: '330px',
      },
      {
        id: 'for',
        label: 'Pending period',
        renderCell: ({ data: { forDuration } }) => {
          return <>{forDuration}</>;
        },
        size: 0.5,
      },
      {
        id: 'numberEvaluations',
        label: '#Eval',
        renderCell: ({ data: { evaluationsToFire: numberEvaluations } }) => {
          if (unknownCurrentInterval) {
            return <ForBadge message="#Evaluations not available." />;
          } else {
            if (!isValidEvaluation(currentInterval)) {
              return <ForBadge message={'Invalid evaluation interval format'} error />;
            }
            if (numberEvaluations === 0) {
              return (
                <ForBadge message="Invalid 'For' value: it should be greater or equal to evaluation interval." error />
              );
            } else {
              return <>{numberEvaluations}</>;
            }
          }
        },
        size: 0.4,
      },
    ];
  }, [currentInterval, unknownCurrentInterval]);

  return (
    <div className={styles.tableWrapper}>
      <DynamicTable items={rows} cols={columns} pagination={{ itemsPerPage: ITEMS_PER_PAGE }} />
    </div>
  );
};

interface FormValues {
  namespaceName: string;
  groupName: string;
  groupInterval: string;
}

export const evaluateEveryValidationOptions = <T extends FieldValues>(rules: RulerRuleDTO[]): RegisterOptions<T> => ({
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (evaluateEvery: string) => {
    try {
      const duration = parsePrometheusDuration(evaluateEvery);

      if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
        return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }

      if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
        return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }
      if (rulesInSameGroupHaveInvalidFor(rules, evaluateEvery).length === 0) {
        return true;
      } else {
        const rulePendingPeriods = rules.map((rule) => {
          const { forDuration } = getAlertInfo(rule, evaluateEvery);
          return forDuration ? safeParsePrometheusDuration(forDuration) : null;
        });
        const largestPendingPeriod = Math.min(
          ...rulePendingPeriods.filter((period): period is number => period !== null)
        );
        return `Evaluation interval should be smaller or equal to "pending period" values for existing rules in this rule group. Choose a value smaller than or equal to "${formatPrometheusDuration(largestPendingPeriod)}".`;
      }
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
});

export interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: (saved?: boolean) => void;
  intervalEditOnly?: boolean;
  folderUrl?: string;
  folderUid?: string;
  hideFolder?: boolean;
}

export function EditRuleGroupModal(props: ModalProps): React.ReactElement {
  const { namespace, group, onClose, intervalEditOnly, folderUid } = props;

  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();

  /**
   * This modal can take 3 different actions, depending on what fields were updated.
   *
   *  1. update the rule group details without renaming either the namespace or group
   *  2. rename the rule group, but keeping it in the same namespace
   *  3. move the rule group to a new namespace, optionally with a different group name
   */
  const [updateRuleGroup, updateRuleGroupState] = useUpdateRuleGroupConfiguration();
  const [renameRuleGroup, renameRuleGroupState] = useRenameRuleGroup();
  const [moveRuleGroup, moveRuleGroupState] = useMoveRuleGroup();

  const { loading, error } = anyOfRequestState(updateRuleGroupState, moveRuleGroupState, renameRuleGroupState);

  const defaultValues = useMemo(
    (): FormValues => ({
      namespaceName: decodeGrafanaNamespace(namespace).name,
      groupName: group.name,
      groupInterval: group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
    }),
    [namespace, group.name, group.interval]
  );

  const rulesSourceName = getRulesSourceName(namespace.rulesSource);
  const isGrafanaManagedGroup = rulesSourceName === GRAFANA_RULES_SOURCE_NAME;

  // parse any parent folders the alert rule might be stored in
  const nestedFolderParents = decodeGrafanaNamespace(namespace).parents;

  const nameSpaceLabel = isGrafanaManagedGroup ? 'Folder' : 'Namespace';

  const onSubmit = async (values: FormValues) => {
    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: rulesSourceName,
      groupName: group.name,
      namespaceName: isGrafanaManagedGroup ? folderUid! : namespace.name,
    };

    // make sure that when dealing with a nested folder for Grafana managed rules we encode the folder properly
    const updatedNamespaceName = isGrafanaManagedGroup
      ? encodeGrafanaNamespace(values.namespaceName, nestedFolderParents)
      : values.namespaceName;
    const updatedGroupName = values.groupName;
    const updatedInterval = values.groupInterval;

    // GMA alert rules cannot be moved to another folder, we currently do not support it but it should be doable (with caveats).
    const shouldMove = isGrafanaManagedGroup ? false : updatedNamespaceName !== ruleGroupIdentifier.namespaceName;
    const shouldRename = updatedGroupName !== ruleGroupIdentifier.groupName;

    try {
      if (shouldMove) {
        await moveRuleGroup.execute(ruleGroupIdentifier, updatedNamespaceName, updatedGroupName, updatedInterval);
      } else if (shouldRename) {
        await renameRuleGroup.execute(ruleGroupIdentifier, updatedGroupName, updatedInterval);
      } else {
        await updateRuleGroup.execute(ruleGroupIdentifier, updatedInterval);
      }
      onClose(true);
      await dispatch(fetchRulerRulesAction({ rulesSourceName }));
    } catch (_error) {} // React hook form will handle errors
  };

  const formAPI = useForm<FormValues>({
    mode: 'onBlur',
    defaultValues,
    shouldFocusError: true,
  });

  const {
    handleSubmit,
    register,
    watch,
    formState: { isDirty, errors, isValid },
    setValue,
    getValues,
  } = formAPI;

  const onInvalid = () => {
    notifyApp.error('There are errors in the form. Correct the errors and retry.');
  };

  const rulesWithoutRecordingRules = compact(
    group.rules.map((r) => r.rulerRule).filter((rule) => !isGrafanaOrDataSourceRecordingRule(rule))
  );
  const hasSomeNoRecordingRules = rulesWithoutRecordingRules.length > 0;
  const modalTitle =
    intervalEditOnly || isGrafanaManagedGroup ? 'Edit evaluation group' : 'Edit namespace or evaluation group';

  return (
    <Modal className={styles.modal} isOpen={true} title={modalTitle} onDismiss={onClose} onClickBackdrop={onClose}>
      <FormProvider {...formAPI}>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} key={JSON.stringify(defaultValues)}>
          <>
            {!props.hideFolder && (
              <Stack gap={1} alignItems={'center'}>
                <Field
                  className={styles.formInput}
                  label={
                    <Label
                      htmlFor="namespaceName"
                      description={
                        !isGrafanaManagedGroup &&
                        'Change the current namespace name. Moving groups between namespaces is not supported'
                      }
                    >
                      {nameSpaceLabel}
                    </Label>
                  }
                  invalid={Boolean(errors.namespaceName) ? true : undefined}
                  error={errors.namespaceName?.message}
                >
                  <Input
                    id="namespaceName"
                    readOnly={intervalEditOnly || isGrafanaManagedGroup}
                    {...register('namespaceName', {
                      required: 'Namespace name is required.',
                    })}
                  />
                </Field>
                {isGrafanaManagedGroup && props.folderUrl && (
                  <LinkButton
                    href={props.folderUrl}
                    title="Go to folder"
                    variant="secondary"
                    icon="folder-open"
                    target="_blank"
                  />
                )}
              </Stack>
            )}
            <Field
              label={
                <Label
                  htmlFor="groupName"
                  description="A group evaluates all its rules over the same evaluation interval."
                >
                  Evaluation group
                </Label>
              }
              invalid={!!errors.groupName}
              error={errors.groupName?.message}
            >
              <Input
                autoFocus={true}
                id="groupName"
                readOnly={intervalEditOnly}
                {...register('groupName', {
                  required: 'Evaluation group name is required.',
                })}
              />
            </Field>
            <Field
              label={
                <Label
                  htmlFor="groupInterval"
                  description="How often is the rule evaluated. Applies to every rule within the group."
                >
                  <Stack gap={0.5}>Evaluation interval</Stack>
                </Label>
              }
              invalid={Boolean(errors.groupInterval) ? true : undefined}
              error={errors.groupInterval?.message}
            >
              <Stack direction="column">
                <Input
                  id="groupInterval"
                  placeholder={DEFAULT_GROUP_EVALUATION_INTERVAL}
                  {...register('groupInterval', evaluateEveryValidationOptions(rulesWithoutRecordingRules))}
                />
                <EvaluationGroupQuickPick
                  currentInterval={getValues('groupInterval')}
                  onSelect={(value) => setValue('groupInterval', value, { shouldValidate: true, shouldDirty: true })}
                />
              </Stack>
            </Field>

            {/* if we're dealing with a Grafana-managed group, check if the evaluation interval is valid / permitted */}
            {isGrafanaManagedGroup && checkEvaluationIntervalGlobalLimit(watch('groupInterval')).exceedsLimit && (
              <EvaluationIntervalLimitExceeded />
            )}

            {!hasSomeNoRecordingRules && <div>This group does not contain alert rules.</div>}
            {hasSomeNoRecordingRules && (
              <>
                <div>List of rules that belong to this group</div>
                <div className={styles.evalRequiredLabel}>
                  #Eval column represents the number of evaluations needed before alert starts firing.
                </div>
                <RulesForGroupTable rulesWithoutRecordingRules={rulesWithoutRecordingRules} />
              </>
            )}
            {error && <Alert title={'Failed to update rule group'}>{stringifyErrorLike(error)}</Alert>}
            <div className={styles.modalButtons}>
              <Modal.ButtonRow>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => onClose(false)}
                  fill="outline"
                >
                  <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={!isDirty || !isValid || loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </Modal.ButtonRow>
            </div>
          </>
        </form>
      </FormProvider>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    maxWidth: '560px',
  }),
  modalButtons: css({
    top: '-24px',
    position: 'relative',
  }),
  formInput: css({
    flex: 1,
  }),
  tableWrapper: css({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    height: '100%',
  }),
  evalRequiredLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
