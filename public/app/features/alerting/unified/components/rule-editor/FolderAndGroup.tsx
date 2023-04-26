import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AsyncSelect, Field, InputControl, Label, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, useDispatch } from 'app/types';

import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../state/actions';
import { RuleForm, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { InfoIcon } from '../InfoIcon';

import { MINUTE } from './AlertRuleForm';
import { Folder, RuleFolderPicker } from './RuleFolderPicker';
import { checkForPathSeparator } from './util';

export const SLICE_GROUP_RESULTS_TO = 1000;

interface FolderAndGroupProps {
  initialFolder: RuleForm | null;
}

export const useGetGroupOptionsFromFolder = (folderTitle: string) => {
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];

  const grafanaFolders = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const folderGroups = grafanaFolders.find((f) => f.name === folderTitle)?.groups ?? [];

  const nonProvisionedGroups = folderGroups.filter((g) => {
    return g.rules.every(
      (r) => isGrafanaRulerRule(r.rulerRule) && Boolean(r.rulerRule.grafana_alert.provenance) === false
    );
  });

  const groupOptions = nonProvisionedGroups.map<SelectableValue<string>>((group) => ({
    label: group.name,
    value: group.name,
    description: group.interval ?? MINUTE,
  }));

  return { groupOptions, loading: groupfoldersForGrafana?.loading };
};

export function FolderAndGroup({ initialFolder }: FolderAndGroupProps) {
  const {
    formState: { errors },
    watch,
    control,
  } = useFormContext<RuleFormValues>();

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const folder = watch('folder');
  const group = watch('group');
  const [selectedGroup, setSelectedGroup] = useState<SelectableValue<string>>({ label: group, title: group });
  const initialRender = useRef(true);

  const { groupOptions, loading } = useGetGroupOptionsFromFolder(folder?.title ?? '');

  useEffect(() => setSelectedGroup({ label: group, title: group }), [group, setSelectedGroup]);

  useEffect(() => {
    dispatch(fetchRulerRulesIfNotFetchedYet(GRAFANA_RULES_SOURCE_NAME));
  }, [dispatch]);

  const resetGroup = useCallback(() => {
    if (group && !initialRender.current && folder?.title) {
      setSelectedGroup({ label: '', title: '' });
    }
    initialRender.current = false;
  }, [group, folder?.title]);

  const groupIsInGroupOptions = useCallback(
    (group_: string) => {
      return groupOptions.includes((groupInList: SelectableValue<string>) => groupInList.label === group_);
    },
    [groupOptions]
  );
  const sliceResults = (list: Array<SelectableValue<string>>) => list.slice(0, SLICE_GROUP_RESULTS_TO);

  const getOptions = useCallback(
    async (query: string) => {
      const results = query
        ? sliceResults(
            groupOptions.filter((el) => {
              const label = el.label ?? '';
              return label.toLowerCase().includes(query.toLowerCase());
            })
          )
        : sliceResults(groupOptions);
      return results;
    },
    [groupOptions]
  );

  const debouncedSearch = useMemo(() => {
    return debounce(getOptions, 300, { leading: true });
  }, [getOptions]);

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
                if (!groupIsInGroupOptions(selectedGroup.value ?? '')) {
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
              <AsyncSelect
                disabled={!folder}
                inputId="group"
                key={`my_unique_select_key__${selectedGroup?.title ?? ''}`}
                {...field}
                loadOptions={debouncedSearch}
                loadingMessage={'Loading groups...'}
                defaultOptions={groupOptions}
                defaultValue={selectedGroup}
                getOptionLabel={(option: SelectableValue<string>) => `${option.label}`}
                placeholder={'Evaluation group name'}
                onChange={(value) => {
                  field.onChange(value.label ?? '');
                }}
                value={selectedGroup}
                allowCustomValue
                formatCreateLabel={(_) => '+ Add new '}
                noOptionsMessage="Start typing to create evaluation group"
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
