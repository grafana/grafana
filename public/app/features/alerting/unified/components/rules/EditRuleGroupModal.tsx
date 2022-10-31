import { css } from '@emotion/css';
import React, { useEffect, useMemo } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';

import { durationToMilliseconds, GrafanaTheme2, parseDuration } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Modal, Button, Field, Input, useStyles2, Label, Icon, Tooltip } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import {
  RulerRulesConfigDTO,
  RulerRuleGroupDTO,
  RulerRuleDTO,
  RulerGrafanaRuleDTO,
  RulerAlertingRuleDTO,
} from 'app/types/unified-alerting-dto';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { getRulesSourceName } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';
import { evaluateEveryValidationOptions } from '../rule-editor/GrafanaEvaluationBehavior';

const MINUTE = '1m';
interface AlertInfo {
  alertName: string;
  forDuration: string;
  numberEvaluations: number;
}

const getNumberEvaluationsToStartAlerting = (forDuration: string, currentEvaluation: string) => {
  const evalNumber = durationToMilliseconds(safeParseDurationstr(currentEvaluation));
  const forNumber = durationToMilliseconds(safeParseDurationstr(forDuration));
  if (evalNumber === 0) {
    return 0;
  } else {
    return Math.ceil(forNumber / evalNumber);
  }
};

export const isRulerGrafanaRuleDTO = (rule: RulerRuleDTO): rule is RulerGrafanaRuleDTO => 'grafana_alert' in rule;
export const isAlertingRuleDTO = (rule: RulerRuleDTO): rule is RulerAlertingRuleDTO => 'alert' in rule;

export const getAlertInfo = (alert: RulerRuleDTO, currentEvaluation: string): AlertInfo => {
  const emptyAlert: AlertInfo = {
    alertName: '',
    forDuration: '0s',
    numberEvaluations: 0,
  };
  if (isRulerGrafanaRuleDTO(alert)) {
    return {
      alertName: alert.grafana_alert.title,
      forDuration: alert.for,
      numberEvaluations: getNumberEvaluationsToStartAlerting(alert.for, currentEvaluation),
    };
  }
  if (isAlertingRuleDTO(alert)) {
    return {
      alertName: alert.alert,
      forDuration: alert.for ?? '1m',
      numberEvaluations: getNumberEvaluationsToStartAlerting(alert.for ?? '1m', currentEvaluation),
    };
  }
  return emptyAlert;
};

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

// parseDuration method needs units separated by space
export const safeParseDurationstr = (duration: string) => {
  const reg = /(?<=[a-z])(?=\d)/i;
  return parseDuration(duration.replace(reg, ' '));
};

type AlertsWithForTableColumnProps = DynamicTableColumnProps<AlertInfo>;
type AlertsWithForTableProps = DynamicTableItemProps<AlertInfo>;

export const RulesForGroupTable = ({
  rulerRules,
  group,
  folder,
}: {
  rulerRules: RulerRulesConfigDTO | null | undefined;
  group: string;
  folder: string;
}) => {
  const styles = useStyles2(getStyles);
  const folderObj: Array<RulerRuleGroupDTO<RulerRuleDTO>> = rulerRules ? rulerRules[folder] : [];
  const groupObj = folderObj?.find((rule) => rule.name === group);
  const rules: RulerRuleDTO[] = groupObj?.rules ?? [];

  const { watch } = useFormContext<FormValues>();
  const currentInterval = watch('groupInterval');

  const rows: AlertsWithForTableProps[] = rules
    .slice()
    .sort(
      (alert1, alert2) =>
        durationToMilliseconds(safeParseDurationstr(getAlertInfo(alert1, currentInterval).forDuration)) -
        durationToMilliseconds(safeParseDurationstr(getAlertInfo(alert2, currentInterval).forDuration))
    )
    .map((rule: RulerRuleDTO, index) => ({
      id: index,
      data: getAlertInfo(rule, currentInterval),
    }));

  //add a hint that would say how many evaluations need to start alerting.
  function getColumns(currentEvaluation: string): AlertsWithForTableColumnProps[] {
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
        renderCell: ({ data: { numberEvaluations } }) => {
          return <>{numberEvaluations}</>;
        },
        size: 0.2,
      },
    ];
  }
  return (
    <div className={styles.tableWrapper}>
      <DynamicTable items={rows} cols={getColumns(currentInterval)} />
    </div>
  );
};

interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: (saved?: boolean) => void;
}

interface FormValues {
  namespaceName: string;
  groupName: string;
  groupInterval: string;
}

function InfoIcon({ text }: { text: string }) {
  return (
    <Tooltip placement="top" content={<div>{text}</div>}>
      <Icon name="info-circle" size="xs" />
    </Tooltip>
  );
}

export function EditCloudGroupModal(props: ModalProps): React.ReactElement {
  const { namespace, group, onClose } = props;
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
        rulesSourceName: getRulesSourceName(namespace.rulesSource),
        groupName: group.name,
        newGroupName: values.groupName,
        namespaceName: namespace.name,
        newNamespaceName: values.namespaceName,
        groupInterval: values.groupInterval || undefined,
      })
    );
  };

  const formAPI = useForm<FormValues>({
    mode: 'onSubmit',
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
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForSource = rulerRuleRequests[getRulesSourceName(namespace.rulesSource)];

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title="Edit namespace or evaluation group"
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
                    NameSpace
                    <InfoIcon text={'You can update name space'} />
                  </Stack>
                </Label>
              }
              invalid={!!errors.namespaceName}
              error={errors.namespaceName?.message}
            >
              <Input
                id="namespaceName"
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
                    <InfoIcon text={'You can update group name'} />
                  </Stack>
                </Label>
              }
              invalid={!!errors.groupName}
              error={errors.groupName?.message}
            >
              <Input
                id="groupName"
                {...register('groupName', {
                  required: 'Evaluation group name is required.',
                })}
              />
            </Field>
            <Field
              label={
                <Label
                  htmlFor="groupInterval"
                  description="Evaluation interval should be smaller or equal than For values for existing rules in this group."
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
                {...register('groupInterval', evaluateEveryValidationOptions)}
              />
            </Field>

            {checkEvaluationIntervalGlobalLimit(watch('groupInterval')).exceedsLimit && (
              <EvaluationIntervalLimitExceeded />
            )}
            {rulerRuleRequests && (
              <>
                <div>List of rules that belong to this group</div>
                <div className={styles.evalRequiredLabel}>
                  #Evaluations column represents number of evaluations neededed before alert starts firing.
                </div>
                <RulesForGroupTable
                  rulerRules={groupfoldersForSource.result}
                  group={group.name}
                  folder={namespace.name}
                />
              </>
            )}

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
  formInput: css`
    width: 275px;
    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
  tableWrapper: css`
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
    height: 225px;
    overflow: auto;
  `,
  evalRequiredLabel: css`
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
