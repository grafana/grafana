import { css } from '@emotion/css';
import { useId, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Field, Select, Stack, Text, useStyles2 } from '@grafana/ui';

import { useFetchGroupsForFolder } from '../../hooks/useFetchGroupsForFolder';
import { type RuleFormValues } from '../../types/rule-form';
import { ProvisioningBadge } from '../Provisioning';

import { EvaluationGroupCreationModal, namespaceToGroupOptions } from './GrafanaEvaluationBehavior';

export type GroupOption = SelectableValue<string> & { isProvisioned?: boolean };

export function EvaluationGroupFieldRow({ enableProvisionedGroups }: { enableProvisionedGroups: boolean }) {
  const styles = useStyles2(getStyles);
  const groupInputId = useId();

  const {
    watch,
    setValue,
    getValues,
    formState: { errors },
    control,
  } = useFormContext<RuleFormValues>();

  const [group, folder, evaluateEvery] = watch(['group', 'folder', 'evaluateEvery']);
  const { currentData: rulerNamespace, isLoading: loadingGroups } = useFetchGroupsForFolder(folder?.uid ?? '');

  const groupOptions = useMemo<GroupOption[]>(() => {
    if (!rulerNamespace) {
      return [];
    }
    const pendingGroup = group ? { name: group, interval: evaluateEvery } : undefined;
    return namespaceToGroupOptions(rulerNamespace, enableProvisionedGroups, pendingGroup);
  }, [enableProvisionedGroups, rulerNamespace, group, evaluateEvery]);

  const defaultGroupValue = group ? { value: group, label: group } : undefined;

  const [isCreatingEvaluationGroup, setIsCreatingEvaluationGroup] = useState(false);
  const onOpenEvaluationGroupCreationModal = () => setIsCreatingEvaluationGroup(true);

  const handleEvalGroupCreation = (groupName: string, evaluationInterval: string) => {
    setValue('group', groupName);
    setValue('evaluateEvery', evaluationInterval);
    setIsCreatingEvaluationGroup(false);
  };

  const label = !folder?.uid
    ? t(
        'alerting.rule-form.evaluation.select-folder-before',
        'Select a folder before setting evaluation group and interval'
      )
    : t('alerting.rule-form.evaluation.evaluation-group-and-interval', 'Evaluation group and interval');

  return (
    <Stack alignItems="end">
      <div className={styles.formContainer}>
        <Field
          noMargin
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
                inputId={groupInputId}
                {...field}
                onChange={(group) => {
                  field.onChange(group.label ?? '');
                }}
                isLoading={loadingGroups}
                invalid={Boolean(folder?.uid) && !group && Boolean(fieldState.error)}
                cacheOptions
                loadingMessage={t(
                  'alerting.grafana-evaluation-behavior-step.loadingMessage-loading-groups',
                  'Loading groups...'
                )}
                defaultValue={defaultGroupValue}
                options={groupOptions}
                getOptionLabel={(option: GroupOption) => (
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
                placeholder={t(
                  'alerting.grafana-evaluation-behavior-step.placeholder-select-an-evaluation-group',
                  'Select an evaluation group...'
                )}
              />
            )}
            name="group"
            control={control}
            rules={{
              required: {
                value: true,
                message: t(
                  'alerting.grafana-evaluation-behavior-step.message.must-enter-a-group-name',
                  'Must enter a group name'
                ),
              },
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
          data-testid={'new-evaluation-group-button'}
        >
          <Trans i18nKey="alerting.rule-form.evaluation.new-group">New evaluation group</Trans>
        </Button>
      </Box>
      {isCreatingEvaluationGroup && (
        <EvaluationGroupCreationModal
          onCreate={handleEvalGroupCreation}
          onClose={() => setIsCreatingEvaluationGroup(false)}
        />
      )}
      {getValues('group') && getValues('evaluateEvery') && (
        <div className={styles.evaluationContainer}>
          <Stack direction="column" gap={0}>
            <div className={styles.marginTop}>
              <Stack direction="column" gap={1}>
                <Trans
                  i18nKey="alerting.rule-form.evaluation.group-text"
                  values={{ evaluateEvery: getValues('evaluateEvery') }}
                >
                  All rules in the selected group are evaluated every {{ evaluateEvery: getValues('evaluateEvery') }}.
                </Trans>
              </Stack>
            </div>
          </Stack>
        </div>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    formContainer: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.sm,
    }),
    formInput: css({
      flexGrow: 1,
    }),
    evaluationContainer: css({
      color: theme.colors.text.secondary,
      maxWidth: `${theme.breakpoints.values.sm}px`,
      fontSize: theme.typography.size.sm,
    }),
    marginTop: css({
      marginTop: theme.spacing(1),
    }),
  };
}
