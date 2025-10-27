import { css } from '@emotion/css';
import { useId, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Field, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { useFetchGroupsForFolder } from '../../hooks/useFetchGroupsForFolder';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../rule-editor/formDefaults';
import { RuleFormValues } from '../../types/rule-form';
import { isProvisionedRuleGroup } from '../../utils/rules';
import { ProvisioningBadge } from '../Provisioning';

import { EvaluationGroupCreationModal } from './GrafanaEvaluationBehavior';

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

  const [group, folder] = watch(['group', 'folder']);
  const { currentData: rulerNamespace, isLoading: loadingGroups } = useFetchGroupsForFolder(folder?.uid ?? '');

  const collator = useMemo(() => new Intl.Collator(), []);
  const groupOptions = useMemo<GroupOption[]>(() => {
    if (!rulerNamespace) {
      return [];
    }
    const folderGroups = Object.values(rulerNamespace).flat();
    return folderGroups
      .map<GroupOption>((g: RulerRuleGroupDTO) => {
        const provisioned = isProvisionedRuleGroup(g);
        return {
          label: g.name,
          value: g.name,
          description: g.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
          isDisabled: !enableProvisionedGroups ? provisioned : false,
          isProvisioned: provisioned,
        };
      })
      .sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));
  }, [collator, enableProvisionedGroups, rulerNamespace]);

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
    <Stack alignItems="center">
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
          groupfoldersForGrafana={rulerNamespace}
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
