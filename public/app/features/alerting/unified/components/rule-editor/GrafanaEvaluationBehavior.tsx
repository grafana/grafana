import { css, cx } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { RegisterOptions, useFormContext } from 'react-hook-form';

import { durationToMilliseconds, GrafanaTheme2, parseDuration } from '@grafana/data';
import {
  Button,
  Card,
  Field,
  Icon,
  InlineLabel,
  Input,
  InputControl,
  LoadingPlaceholder,
  useStyles2,
} from '@grafana/ui';
import { RulerRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { isRulerGrafanaRuleDTO } from '../../state/actions';
import { RuleForm, RuleFormValues } from '../../types/rule-form';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { parseDurationToMilliseconds, parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';

import { FolderAndGroup } from './FolderAndGroup';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';

const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds
const MINUTE = '1m';

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
export const evaluateEveryValidationOptions: RegisterOptions = {
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

      return true;
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to parse duration';
    }
  },
};

function FolderGroupAndEvaluationInterval({
  initialFolder,
  initialRuleName,
  initialEvaluateEvery,
}: {
  initialFolder: RuleForm | null;
  initialRuleName: string;
  initialEvaluateEvery: number;
}) {
  const styles = useStyles2(getStyles);
  const [editInterval, setEditInterval] = useState(false);
  const {
    setFocus,
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<RuleFormValues>();

  const group = watch('group');
  const folder = watch('folder');
  const evaluateEveryId = 'eval-every-input';
  const evaluateEvery = watch('evaluateEvery');
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const someRulesBelongToThisGroup = (
    initialRuleName: string,
    rulerRules: RulerRulesConfigDTO | null | undefined,
    group: string,
    folder_: string
  ) => {
    const folderObj: Array<RulerRuleGroupDTO<RulerRuleDTO>> = rulerRules ? rulerRules[folder_] : [];
    const groupObj = folderObj?.find((rule) => rule.name === group);

    const rules = groupObj?.rules ?? [];
    return rules.find((rule) => (isRulerGrafanaRuleDTO(rule) ? rule.grafana_alert.title !== initialRuleName : false));
  };

  const onBlur = () => setEditInterval(false);
  const evaluateEveryValidationOptions: RegisterOptions = {
    required: {
      value: true,
      message: 'Required.',
    },
    validate: (value: string) => {
      const duration = parseDuration(value);
      if (Object.keys(duration).length) {
        const diff = durationToMilliseconds(duration);
        if (diff < MIN_TIME_RANGE_STEP_S * 1000) {
          return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
        }
        if (diff % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
          return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
        }
      }
      return true;
    },
  };

  useEffect(() => {
    group &&
      folder &&
      setValue('evaluateEvery', getIntervalForGroup(groupfoldersForGrafana?.result, group, folder?.title ?? ''));
  }, [group, folder, groupfoldersForGrafana?.result, setValue]);

  useEffect(() => {
    editInterval && setFocus('evaluateEvery');
  }, [editInterval, setFocus]);

  const intervalHasChanged = initialEvaluateEvery !== parseDurationToMilliseconds(evaluateEvery);
  return (
    <div>
      <FolderAndGroup initialFolder={initialFolder} />
      <Card className={styles.cardContainer}>
        <Card.Heading>Group behaviour</Card.Heading>
        <Card.Meta>
          {`Evaluation interval applies to every rule within a group. 
            It can overwrite the interval of an existing alert rule. 
            Click on 'Edit group behaviour' button to edit this group value.`}
        </Card.Meta>
        <Card.Actions>
          {intervalHasChanged &&
          !editInterval &&
          someRulesBelongToThisGroup(initialRuleName, groupfoldersForGrafana?.result, group, folder?.title ?? '') ? (
            <>
              <div className={styles.intervalChangedLabel}>
                <Icon name="exclamation-triangle" size="xs" className={cx('text-warning', styles.warningIcon)} />
                {`More alert rules belong to this group.You are going to update evaluation interval for group '${group}' with this new value: `}
                <span className={cx('text-warning')}>{evaluateEvery}</span>
              </div>
              <div className={cx('text-warning')}>
                You should review the For duration, for all alerts that belong to this group
              </div>
            </>
          ) : (
            intervalHasChanged &&
            !editInterval && (
              <div className={styles.intervalChangedLabel}>
                {`Evaluation interval for group '${group}' will be updated with: `}
                <span className={cx('text-warning')}>{evaluateEvery}</span>
              </div>
            )
          )}
          {groupfoldersForGrafana?.loading && <LoadingPlaceholder text="Loading ..." />}
          {!editInterval && (
            <Button
              icon={editInterval ? 'exclamation-circle' : 'edit'}
              type="button"
              variant="secondary"
              disabled={groupfoldersForGrafana?.loading}
              onClick={() => {
                setEditInterval(true);
              }}
            >
              <span>{'Edit group behaviour'}</span>
            </Button>
          )}

          {editInterval && (
            <div className={styles.flexRow}>
              <div className={styles.evaluateLabel}>{`Alert rules in '${group}' are evaluated every`}</div>
              <Field
                className={styles.inlineField}
                error={errors.evaluateEvery?.message}
                invalid={!!errors.evaluateEvery}
                validationMessageHorizontalOverflow={true}
              >
                <Input
                  id={evaluateEveryId}
                  width={8}
                  {...register('evaluateEvery', evaluateEveryValidationOptions)}
                  readOnly={!editInterval}
                  onBlur={onBlur}
                  className={styles.evaluateInput}
                />
              </Field>
            </div>
          )}
        </Card.Actions>
      </Card>
    </div>
  );
}

function ForInput() {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
    watch,
  } = useFormContext<RuleFormValues>();

  const evaluateForId = 'eval-for-input';

  return (
    <div className={styles.flexRow}>
      <InlineLabel
        htmlFor={evaluateForId}
        width={7}
        tooltip='Once condition is breached, alert will go into pending state. If it is pending for longer than the "for" value, it will become a firing alert.'
      >
        for
      </InlineLabel>
      <Field
        className={styles.inlineField}
        error={errors.evaluateFor?.message}
        invalid={!!errors.evaluateFor?.message}
        validationMessageHorizontalOverflow={true}
      >
        <Input
          id={evaluateForId}
          width={8}
          {...register('evaluateFor', forValidationOptions(watch('evaluateEvery')))}
        />
      </Field>
    </div>
  );
}

export function GrafanaEvaluationBehavior({
  initialFolder,
  initialRuleName,
  initialEvaluateEvery,
}: {
  initialFolder: RuleForm | null;
  initialRuleName: string;
  initialEvaluateEvery: number;
}) {
  const styles = useStyles2(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const { watch } = useFormContext<RuleFormValues>();

  const { exceedsLimit: exceedsGlobalEvaluationLimit } = checkEvaluationIntervalGlobalLimit(watch('evaluateEvery'));

  return (
    // TODO remove "and alert condition" for recording rules
    <RuleEditorSection stepNo={3} title="Alert evaluation behavior">
      <div className={styles.flexColumn}>
        <FolderGroupAndEvaluationInterval
          initialFolder={initialFolder}
          initialRuleName={initialRuleName}
          initialEvaluateEvery={initialEvaluateEvery}
        />
        <ForInput />
      </div>
      {exceedsGlobalEvaluationLimit && <EvaluationIntervalLimitExceeded />}
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
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
  `,
  inlineField: css`
    margin-bottom: 0;
  `,
  flexColumn: css`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
  `,
  collapseToggle: css`
    margin: ${theme.spacing(2, 0, 2, -1)};
  `,
  evaluateLabel: css`
    align-self: center;
    margin-right: ${theme.spacing(1)};
  `,
  evaluateInput: css`
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
  `,
});
