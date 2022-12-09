import { css } from '@emotion/css';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Field, InputControl, Label, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { FolderPickerFilter } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/core';
import { DashboardSearchHit } from 'app/features/search/types';
import { AccessControlAction, useDispatch } from 'app/types';
import { RulerRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../state/actions';
import { RuleForm, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { InfoIcon } from '../InfoIcon';

import { getIntervalForGroup } from './GrafanaEvaluationBehavior';
import { containsSlashes, Folder, RuleFolderPicker } from './RuleFolderPicker';
import { SelectWithAdd } from './SelectWIthAdd';
import { checkForPathSeparator } from './util';

const useGetGroups = (groupfoldersForGrafana: RulerRulesConfigDTO | null | undefined, folderName: string) => {
  const groupOptions = useMemo(() => {
    const groupsForFolderResult: Array<RulerRuleGroupDTO<RulerRuleDTO>> = groupfoldersForGrafana
      ? groupfoldersForGrafana[folderName] ?? []
      : [];

    const folderGroups = groupsForFolderResult.map((group) => ({
      name: group.name,
      provisioned: group.rules.some((rule) => isGrafanaRulerRule(rule) && Boolean(rule.grafana_alert.provenance)),
    }));

    return folderGroups.filter((group) => !group.provisioned).map((group) => group.name);
  }, [groupfoldersForGrafana, folderName]);

  return groupOptions;
};

function mapGroupsToOptions(groups: string[]): Array<SelectableValue<string>> {
  return groups.map((group) => ({ label: group, value: group }));
}
interface FolderAndGroupProps {
  initialFolder: RuleForm | null;
}

export const useGetGroupOptionsFromFolder = (folderTitle: string) => {
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const groupOptions: Array<SelectableValue<string>> = mapGroupsToOptions(
    useGetGroups(groupfoldersForGrafana?.result, folderTitle)
  );
  const groupsForFolder = groupfoldersForGrafana?.result;
  return { groupOptions, groupsForFolder, loading: groupfoldersForGrafana?.loading };
};

const useRuleFolderFilter = (existingRuleForm: RuleForm | null) => {
  const isSearchHitAvailable = useCallback(
    (hit: DashboardSearchHit) => {
      const rbacDisabledFallback = contextSrv.hasEditPermissionInFolders;

      const canCreateRuleInFolder = contextSrv.hasAccessInMetadata(
        AccessControlAction.AlertingRuleCreate,
        hit,
        rbacDisabledFallback
      );

      const canUpdateInCurrentFolder =
        existingRuleForm &&
        hit.folderId === existingRuleForm.id &&
        contextSrv.hasAccessInMetadata(AccessControlAction.AlertingRuleUpdate, hit, rbacDisabledFallback);
      return canCreateRuleInFolder || canUpdateInCurrentFolder;
    },
    [existingRuleForm]
  );

  return useCallback<FolderPickerFilter>(
    (folderHits) =>
      folderHits
        .filter(isSearchHitAvailable)
        .filter((value: DashboardSearchHit) => !containsSlashes(value.title ?? '')),
    [isSearchHitAvailable]
  );
};

export function FolderAndGroup({ initialFolder }: FolderAndGroupProps) {
  const {
    formState: { errors },
    watch,
    control,
    setValue,
  } = useFormContext<RuleFormValues>();

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const folderFilter = useRuleFolderFilter(initialFolder);
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  const folder = watch('folder');
  const group = watch('group');
  const [selectedGroup, setSelectedGroup] = useState(group);
  const initialRender = useRef(true);

  const { groupOptions, groupsForFolder, loading } = useGetGroupOptionsFromFolder(folder?.title ?? '');

  useEffect(() => setSelectedGroup(group), [group, setSelectedGroup]);

  useEffect(() => {
    dispatch(fetchRulerRulesIfNotFetchedYet(GRAFANA_RULES_SOURCE_NAME));
  }, [dispatch]);

  const resetGroup = useCallback(() => {
    if (group && !initialRender.current && folder?.title) {
      setSelectedGroup('');
    }
    initialRender.current = false;
  }, [group, folder?.title]);

  useEffect(() => {
    setValue('group', selectedGroup);
  }, [selectedGroup, setValue]);

  const groupIsInGroupOptions = useCallback(
    (group_: string) => {
      return groupOptions.includes((groupInList: SelectableValue<string>) => groupInList.label === group_);
    },
    [groupOptions]
  );

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
              filter={folderFilter}
              dissalowSlashes={true}
              onChange={({ title, uid }) => {
                field.onChange({ title, uid });
                if (!groupIsInGroupOptions(selectedGroup)) {
                  setIsAddingGroup(false);
                  resetGroup();
                }
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
          render={({ field: { ref, ...field } }) =>
            loading ? (
              <LoadingPlaceholder text="Loading..." />
            ) : (
              <SelectWithAdd
                key={`my_unique_select_key__${folder?.title ?? ''}`}
                {...field}
                options={groupOptions}
                getOptionLabel={(option: SelectableValue<string>) =>
                  `${option.label}  (${getIntervalForGroup(groupsForFolder, option.label ?? '', folder?.title ?? '')})`
                }
                value={selectedGroup}
                custom={isAddingGroup}
                onCustomChange={(custom: boolean) => setIsAddingGroup(custom)}
                placeholder="Evaluation group name"
                onChange={(value: string) => {
                  field.onChange(value);
                  setSelectedGroup(value);
                }}
              />
            )
          }
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
