import { css } from '@emotion/css';
import { compact } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { FormProvider, RegisterOptions, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Field, Input, Label, LinkButton, Modal, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { rulesInSameGroupHaveInvalidFor, updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { getRulesSourceName, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from '../../utils/rules';
import { parsePrometheusDuration } from '../../utils/time';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { InfoIcon } from '../InfoIcon';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';
import { MIN_TIME_RANGE_STEP_S } from '../rule-editor/GrafanaEvaluationBehavior';

const ITEMS_PER_PAGE = 10;

interface AlertInfo {
  alertName: string;
  forDuration: string;
  evaluationsToFire: number;
}

function ForBadge({ message, error }: { message: string; error?: boolean }) {
  if (error) {
    return <Badge color="red" icon="exclamation-circle" text={'Error'} tooltip={message} />;
  } else {
    return <Badge color="orange" icon="exclamation-triangle" text={'Unknown'} tooltip={message} />;
  }
}

export const getNumberEvaluationsToStartAlerting = (forDuration: string, currentEvaluation: string) => {
  const evalNumberMs = safeParseDurationstr(currentEvaluation);
  const forNumber = safeParseDurationstr(forDuration);
  if (forNumber === 0 && evalNumberMs !== 0) {
    return 1;
  }
  if (evalNumberMs === 0) {
    return 0;
  } else {
    const evaluationsBeforeCeil = forNumber / evalNumberMs;
    return evaluationsBeforeCeil < 1 ? 0 : Math.ceil(forNumber / evalNumberMs) + 1;
  }
};

export const getAlertInfo = (alert: RulerRuleDTO, currentEvaluation: string): AlertInfo => {
  const emptyAlert: AlertInfo = {
    alertName: '',
    forDuration: '0s',
    evaluationsToFire: 0,
  };
  if (isGrafanaRulerRule(alert)) {
    return {
      alertName: alert.grafana_alert.title,
      forDuration: alert.for,
      evaluationsToFire: getNumberEvaluationsToStartAlerting(alert.for, currentEvaluation),
    };
  }
  if (isAlertingRulerRule(alert)) {
    return {
      alertName: alert.alert,
      forDuration: alert.for ?? '1m',
      evaluationsToFire: getNumberEvaluationsToStartAlerting(alert.for ?? '1m', currentEvaluation),
    };
  }
  return emptyAlert;
};
export const isValidEvaluation = (evaluation: string) => {
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

export const getGroupFromRuler = (
  rulerRules: RulerRulesConfigDTO | null | undefined,
  groupName: string,
  folderName: string
) => {
  const folderObj: Array<RulerRuleGroupDTO<RulerRuleDTO>> = rulerRules ? rulerRules[folderName] : [];
  return folderObj?.find((rulerRuleGroup) => rulerRuleGroup.name === groupName);
};
export const safeParseDurationstr = (duration: string): number => {
  try {
    return parsePrometheusDuration(duration);
  } catch (e) {
    return 0;
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
      (alert1, alert2) => safeParseDurationstr(alert1.data.forDuration) - safeParseDurationstr(alert2.data.forDuration)
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
        label: 'For',
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

export const evaluateEveryValidationOptions = (rules: RulerRuleDTO[]): RegisterOptions => ({
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
        return `Invalid evaluation interval. Evaluation interval should be smaller or equal to 'For' values for existing rules in this group.`;
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
}

export function EditCloudGroupModal(props: ModalProps): React.ReactElement {
  const { namespace, group, onClose, intervalEditOnly } = props;

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { loading, error, dispatched } =
    useUnifiedAlertingSelector((state) => state.updateLotexNamespaceAndGroup) ?? initialAsyncRequestState;
  const notifyApp = useAppNotification();

  const defaultValues = useMemo(
    (): FormValues => ({
      namespaceName: namespace.name,
      groupName: group.name,
      groupInterval: group.interval ?? '',
    }),
    [namespace, group]
  );

  const rulesSourceName = getRulesSourceName(namespace.rulesSource);
  const isGrafanaManagedGroup = rulesSourceName === GRAFANA_RULES_SOURCE_NAME;

  const nameSpaceLabel = isGrafanaManagedGroup ? 'Folder' : 'Namespace';

  // close modal if successfully saved
  useEffect(() => {
    if (dispatched && !loading && !error) {
      onClose(true);
    }
  }, [dispatched, loading, onClose, error]);

  useCleanup((state) => (state.unifiedAlerting.updateLotexNamespaceAndGroup = initialAsyncRequestState));
  const onSubmit = (values: FormValues) => {
    dispatch(
      updateLotexNamespaceAndGroupAction({
        rulesSourceName: rulesSourceName,
        groupName: group.name,
        newGroupName: values.groupName,
        namespaceName: namespace.name,
        newNamespaceName: values.namespaceName,
        groupInterval: values.groupInterval || undefined,
      })
    );
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
    formState: { isDirty, errors },
  } = formAPI;

  const onInvalid = () => {
    notifyApp.error('There are errors in the form. Correct the errors and retry.');
  };

  const rulesWithoutRecordingRules = compact(
    group.rules.map((r) => r.rulerRule).filter((rule) => !isRecordingRulerRule(rule))
  );
  const hasSomeNoRecordingRules = rulesWithoutRecordingRules.length > 0;
  const modalTitle =
    intervalEditOnly || isGrafanaManagedGroup ? 'Edit evaluation group' : 'Edit namespace or evaluation group';

  return (
    <Modal className={styles.modal} isOpen={true} title={modalTitle} onDismiss={onClose} onClickBackdrop={onClose}>
      <FormProvider {...formAPI}>
        <form onSubmit={(e) => e.preventDefault()} key={JSON.stringify(defaultValues)}>
          <>
            <Field
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
              invalid={!!errors.namespaceName}
              error={errors.namespaceName?.message}
            >
              <Stack gap={1} direction="row">
                <Input
                  id="namespaceName"
                  readOnly={intervalEditOnly || isGrafanaManagedGroup}
                  {...register('namespaceName', {
                    required: 'Namespace name is required.',
                  })}
                  className={styles.formInput}
                />
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
            </Field>
            <Field
              label={
                <Label
                  htmlFor="groupName"
                  description={`Evaluation group name needs to be unique within a ${nameSpaceLabel.toLocaleLowerCase()}`}
                >
                  Evaluation group name
                </Label>
              }
              invalid={!!errors.groupName}
              error={errors.groupName?.message}
            >
              <Input
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
                  description="Evaluation interval should be smaller or equal to 'For' values for existing rules in this group."
                >
                  <Stack gap={0.5}>
                    Rule group evaluation interval
                    <InfoIcon text={'How frequently to evaluate rules.'} />
                  </Stack>
                </Label>
              }
              invalid={!!errors.groupInterval}
              error={errors.groupInterval?.message}
            >
              <Input
                id="groupInterval"
                placeholder="1m"
                {...register('groupInterval', evaluateEveryValidationOptions(rulesWithoutRecordingRules))}
              />
            </Field>

            {checkEvaluationIntervalGlobalLimit(watch('groupInterval')).exceedsLimit && (
              <EvaluationIntervalLimitExceeded />
            )}
            <div className={styles.modalButtons}>
              <Modal.ButtonRow>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => onClose(false)}
                  fill="outline"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  disabled={!isDirty || loading}
                  onClick={handleSubmit((values) => onSubmit(values), onInvalid)}
                >
                  {loading ? 'Saving...' : 'Save changes'}
                </Button>
              </Modal.ButtonRow>
            </div>
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
          </>
        </form>
      </FormProvider>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    max-width: 560px;
  `,
  modalButtons: css`
    top: -24px;
    position: relative;
  `,
  formInput: css`
    flex: 1;
  `,
  tableWrapper: css`
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
    height: 100%;
  `,
  evalRequiredLabel: css`
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
