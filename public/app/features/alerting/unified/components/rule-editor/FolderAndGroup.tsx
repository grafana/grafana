import { css } from '@emotion/css';
import { debounce, take, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AsyncSelect, Badge, Field, InputControl, Label, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, useDispatch } from 'app/types';
import { CombinedRuleGroup } from 'app/types/unified-alerting';

import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { MINUTE } from '../../utils/rule-form';
import { isGrafanaRulerRule } from '../../utils/rules';
import { InfoIcon } from '../InfoIcon';

import { Folder, RuleFolderPicker } from './RuleFolderPicker';
import { checkForPathSeparator } from './util';

export const MAX_GROUP_RESULTS = 1000;

export const useGetGroupOptionsFromFolder = (folderTitle: string) => {
  const dispatch = useDispatch();

  // fetch the ruler rules from the database so we can figure out what other "groups" are already defined
  // for our folders
  useEffect(() => {
    dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const grafanaFolders = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const folderGroups = grafanaFolders.find((f) => f.name === folderTitle)?.groups ?? [];

  const groupOptions = folderGroups
    .map<SelectableValue<string>>((group) => ({
      label: group.name,
      value: group.name,
      description: group.interval ?? MINUTE,
      // we include provisioned folders, but disable the option to select them
      isDisabled: isProvisionedGroup(group),
    }))
    .sort(sortByLabel);

  return { groupOptions, loading: groupfoldersForGrafana?.loading };
};

const isProvisionedGroup = (group: CombinedRuleGroup) => {
  return group.rules.some(
    (rule) => isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance) === true
  );
};

const sortByLabel = (a: SelectableValue<string>, b: SelectableValue<string>) => {
  return a.label?.localeCompare(b.label ?? '') || 0;
};

const findGroupMatchingLabel = (group: SelectableValue<string>, query: string) => {
  return group.label?.toLowerCase().includes(query.toLowerCase());
};

export function FolderAndGroup() {
  const {
    formState: { errors },
    watch,
    setValue,
    control,
  } = useFormContext<RuleFormValues>();

  const styles = useStyles2(getStyles);

  const folder = watch('folder');
  const group = watch('group');

  const { groupOptions, loading } = useGetGroupOptionsFromFolder(folder?.title ?? '');

  const resetGroup = useCallback(() => {
    setValue('group', '');
  }, [setValue]);

  const getOptions = useCallback(
    async (query: string) => {
      const results = query ? groupOptions.filter((group) => findGroupMatchingLabel(group, query)) : groupOptions;
      return take(results, MAX_GROUP_RESULTS);
    },
    [groupOptions]
  );

  const debouncedSearch = useMemo(() => {
    return debounce(getOptions, 300, { leading: true });
  }, [getOptions]);

  const defaultGroupValue = group ? { value: group, label: group } : undefined;

  return (
    <div className={styles.container}>
      <Field
        label={
          <Label htmlFor="folder" description={'Select a folder for your rule.'}>
            <Stack gap={0.5}>
              Folder
              <InfoIcon
                text={
                  'Each folder has unique folder permission. When you store multiple rules in a folder, the folder access permissions are assigned to the rules.'
                }
              />
            </Stack>
          </Label>
        }
        className={styles.formInput}
        error={errors.folder?.message}
        invalid={!!errors.folder?.message}
        data-testid="folder-picker"
      >
        <InputControl
          render={({ field: { ref, ...field } }) => (
            <RuleFolderPicker
              inputId="folder"
              {...field}
              enableCreateNew={contextSrv.hasPermission(AccessControlAction.FoldersCreate)}
              enableReset={true}
              onChange={({ title, uid }) => {
                field.onChange({ title, uid });
                resetGroup();
              }}
            />
          )}
          name="folder"
          rules={{
            required: { value: true, message: 'Select a folder' },
            validate: {
              pathSeparator: (folder: Folder) => checkForPathSeparator(folder.title),
            },
          }}
        />
      </Field>

      <Field
        label="Evaluation group (interval)"
        data-testid="group-picker"
        description="Select a group to evaluate all rules in the same group over the same time interval."
        className={styles.formInput}
        error={errors.group?.message}
        invalid={!!errors.group?.message}
      >
        <InputControl
          render={({ field: { ref, ...field }, fieldState }) => (
            <AsyncSelect
              disabled={!folder || loading}
              inputId="group"
              key={uniqueId()}
              {...field}
              onChange={(group) => {
                field.onChange(group.label ?? '');
              }}
              isLoading={loading}
              invalid={Boolean(folder) && !group && Boolean(fieldState.error)}
              loadOptions={debouncedSearch}
              cacheOptions
              loadingMessage={'Loading groups...'}
              defaultValue={defaultGroupValue}
              defaultOptions={groupOptions}
              getOptionLabel={(option: SelectableValue<string>) => (
                <div>
                  <span>{option.label}</span>
                  {/* making the assumption here that it's provisioned when it's disabled, should probably change this */}
                  {option.isDisabled && (
                    <>
                      {' '}
                      <Badge color="purple" text="Provisioned" />
                    </>
                  )}
                </div>
              )}
              placeholder={'Evaluation group name'}
              allowCustomValue
              formatCreateLabel={(_) => '+ Add new '}
              noOptionsMessage="Start typing to create evaluation group"
            />
          )}
          name="group"
          control={control}
          rules={{
            required: { value: true, message: 'Must enter a group name' },
            validate: {
              pathSeparator: (group_: string) => checkForPathSeparator(group_),
            },
          }}
        />
      </Field>
    </div>
  );
}
const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: row;
    align-items: baseline;
    max-width: ${theme.breakpoints.values.sm}px;
    justify-content: space-between;
  `,
  formInput: css`
    width: 275px;

    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
});
