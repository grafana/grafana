import { css } from '@emotion/css';
import React, { useEffect, useMemo } from 'react';
import { FormProvider, RegisterOptions, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Modal, Button, Field, Input, useStyles2, Label, Badge } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO, RulerRuleGroupDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { rulesInSameGroupHaveInvalidFor, updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { isAlertingRulerRule, isGrafanaRulerRule } from '../../utils/rules';
import { parsePrometheusDuration } from '../../utils/time';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { InfoIcon } from '../InfoIcon';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';
import { MIN_TIME_RANGE_STEP_S } from '../rule-editor/GrafanaEvaluationBehavior';

const MINUTE = '1m';
interface AlertInfo {
  alertName: string;
  forDuration: string;
  evaluationsToFire: number;
}
function ForError({ message }: { message: string }) {
  return <Badge color="orange" icon="exclamation-triangle" text={'Error'} tooltip={message} />;
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

export const getIntervalForGroup = (
  rulerRules: RulerRulesConfigDTO | null | undefined,
  groupName: string,
  folderName: string
) => {
  const group = getGroupFromRuler(rulerRules, groupName, folderName);
  const interval = group?.interval ?? MINUTE;
  return interval;
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

export const RulesForGroupTable = ({
  rulerRules,
  groupName,
  folderName,
}: {
  rulerRules: RulerRulesConfigDTO | null | undefined;
  groupName: string;
  folderName: string;
}) => {
  const styles = useStyles2(getStyles);
  const group = getGroupFromRuler(rulerRules, groupName, folderName);
  const rules: RulerRuleDTO[] = group?.rules ?? [];

  const { watch } = useFormContext<FormValues>();
  const currentInterval = watch('groupInterval');

  const rows: AlertsWithForTableProps[] = rules
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
        size: 0.6,
      },
      {
        id: 'for',
        label: 'For',
        renderCell: ({ data: { forDuration } }) => {
          return <>{forDuration}</>;
        },
        size: 0.2,
      },
      {
        id: 'numberEvaluations',
        label: '#Evaluations',
        renderCell: ({ data: { evaluationsToFire: numberEvaluations } }) => {
          if (!isValidEvaluation(currentInterval)) {
            return <ForError message={'Invalid evaluation interval format'} />;
          }
          if (numberEvaluations === 0) {
            return <ForError message="Invalid 'For' value: it should be greater or equal to evaluation interval." />;
          } else {
            return <>{numberEvaluations}</>;
          }
        },
        size: 0.2,
      },
    ];
  }, [currentInterval]);

  return (
    <div className={styles.tableWrapper}>
      <DynamicTable items={rows} cols={columns} />
    </div>
  );
};

interface CombinedGroupAndNameSpace {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
}
interface GroupAndNameSpaceNames {
  namespace: string;
  group: string;
}
interface ModalProps {
  nameSpaceAndGroup: CombinedGroupAndNameSpace | GroupAndNameSpaceNames;
  sourceName: string;
  groupInterval: string;
  onClose: (saved?: boolean) => void;
  folderAndGroupReadOnly?: boolean;
}

interface FormValues {
  namespaceName: string;
  groupName: string;
  groupInterval: string;
}

export const evaluateEveryValidationOptions = (
  rules: RulerRulesConfigDTO | null | undefined,
  groupName: string,
  nameSpaceName: string
): RegisterOptions => ({
  required: {
    value: true,
    message: 'Required.',
  },
  validate: (value: string) => {
    try {
      const duration = parsePrometheusDuration(value);

      if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
        return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }

      if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
        return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
      }
      if (rulesInSameGroupHaveInvalidFor(rules, groupName, nameSpaceName, value).length === 0) {
        return true;
      } else {
        return `Invalid evaluation interval. Evaluation interval should be smaller or equal to 'For' values for existing rules in this group.`;
      }
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
});

export function EditCloudGroupModal(props: ModalProps): React.ReactElement {
  const {
    nameSpaceAndGroup: { namespace, group },
    onClose,
    groupInterval,
    sourceName,
    folderAndGroupReadOnly,
  } = props;

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { loading, error, dispatched } =
    useUnifiedAlertingSelector((state) => state.updateLotexNamespaceAndGroup) ?? initialAsyncRequestState;
  const notifyApp = useAppNotification();
  const nameSpaceName = typeof namespace === 'string' ? namespace : namespace.name;
  const groupName = typeof group === 'string' ? group : group.name;
  const defaultValues = useMemo(
    (): FormValues => ({
      namespaceName: nameSpaceName,
      groupName: groupName,
      groupInterval: groupInterval ?? '',
    }),
    [nameSpaceName, groupName, groupInterval]
  );

  const isGrafanaManagedGroup = sourceName === GRAFANA_RULES_SOURCE_NAME;
  const nameSpaceLabel = isGrafanaManagedGroup ? 'Folder' : 'Namespace';
  const nameSpaceInfoIconLabelEditable = isGrafanaManagedGroup
    ? 'Folder name can be updated to a non-existing folder name'
    : 'Name space can be updated to a non-existing name space';
  const nameSpaceInfoIconLabelNonEditable = isGrafanaManagedGroup
    ? 'Folder name can be updated in folder view'
    : 'Name space can be updated folder view';

  const spaceNameInfoIconLabel = folderAndGroupReadOnly
    ? nameSpaceInfoIconLabelNonEditable
    : nameSpaceInfoIconLabelEditable;
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
        rulesSourceName: sourceName,
        groupName: groupName,
        newGroupName: values.groupName,
        namespaceName: nameSpaceName,
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

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForSource = rulerRuleRequests[sourceName];

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={folderAndGroupReadOnly ? 'Edit evaluation group' : `Edit ${nameSpaceLabel} or evaluation group`}
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <FormProvider {...formAPI}>
        <form onSubmit={(e) => e.preventDefault()} key={JSON.stringify(defaultValues)}>
          <>
            <Field
              label={
                <Label htmlFor="namespaceName">
                  <Stack gap={0.5}>
                    {nameSpaceLabel}
                    <InfoIcon text={spaceNameInfoIconLabel} />
                  </Stack>
                </Label>
              }
              invalid={!!errors.namespaceName}
              error={errors.namespaceName?.message}
            >
              <Input
                id="namespaceName"
                readOnly={folderAndGroupReadOnly}
                {...register('namespaceName', {
                  required: 'Namespace name is required.',
                })}
              />
            </Field>
            <Field
              label={
                <Label htmlFor="groupName">
                  <Stack gap={0.5}>
                    Evaluation group
                    {isGrafanaManagedGroup ? (
                      <InfoIcon text={'Group name can be updated on Group view.'} />
                    ) : (
                      <InfoIcon text={'Group name can be updated to a non existing group name.'} />
                    )}
                  </Stack>
                </Label>
              }
              invalid={!!errors.groupName}
              error={errors.groupName?.message}
            >
              <Input
                id="groupName"
                readOnly={folderAndGroupReadOnly}
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
                {...register(
                  'groupInterval',
                  evaluateEveryValidationOptions(groupfoldersForSource?.result, groupName, nameSpaceName)
                )}
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
            {rulerRuleRequests && (
              <>
                <div>List of rules that belong to this group</div>
                <div className={styles.evalRequiredLabel}>
                  #Evaluations column represents the number of evaluations needed before alert starts firing.
                </div>
                <RulesForGroupTable
                  rulerRules={groupfoldersForSource?.result}
                  groupName={groupName}
                  folderName={nameSpaceName}
                />
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
    width: 275px;
    & + & {
      margin-left: ${theme.spacing(3)};
    }
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
