import { css } from '@emotion/css';
import { debounce, take, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';

import { AppEvents, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { AsyncSelect, Button, Field, Input, InputControl, Label, Modal, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder } from 'app/features/manage-dashboards/state/actions';
import { AccessControlAction, useDispatch } from 'app/types';
import { CombinedRuleGroup } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { MINUTE } from '../../utils/rule-form';
import { isGrafanaRulerRule } from '../../utils/rules';
import { ProvisioningBadge } from '../Provisioning';
import { evaluateEveryValidationOptions } from '../rules/EditRuleGroupModal';

import { containsSlashes, Folder, RuleFolderPicker } from './RuleFolderPicker';
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

export function FolderAndGroup({ groupfoldersForGrafana }: { groupfoldersForGrafana?: RulerRulesConfigDTO | null }) {
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

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingEvaluationGroup, setIsCreatingEvaluationGroup] = useState(false);

  const onOpenFolderCreationModal = () => setIsCreatingFolder(true);
  const onOpenEvaluationGroupCreationModal = () => setIsCreatingEvaluationGroup(true);

  const handleFolderCreation = (folder: Folder) => {
    resetGroup();
    setValue('folder', folder);
    setIsCreatingFolder(false);
  };

  const handleEvalGroupCreation = (groupName: string, evaluationInterval: string) => {
    setValue('group', groupName);
    setValue('evaluateEvery', evaluationInterval);
    setIsCreatingEvaluationGroup(false);
  };

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
      <div className={styles.evaluationGroupsContainer}>
        {
          <Field
            label={
              <Label htmlFor="folder" description={'Select a folder to store your rule.'}>
                Folder
              </Label>
            }
            className={styles.formInput}
            error={errors.folder?.message}
            invalid={!!errors.folder?.message}
            data-testid="folder-picker"
          >
            {(!isCreatingFolder && (
              <InputControl
                render={({ field: { ref, ...field } }) => (
                  <RuleFolderPicker
                    inputId="folder"
                    {...field}
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
            )) || <div>Creating new folder...</div>}
          </Field>
        }

        <div className={styles.addButton}>
          <span>or</span>
          <Button
            onClick={onOpenFolderCreationModal}
            type="button"
            icon="plus"
            fill="outline"
            variant="secondary"
            disabled={!contextSrv.hasPermission(AccessControlAction.FoldersCreate)}
          >
            New folder
          </Button>
        </div>
        {isCreatingFolder && (
          <FolderCreationModal onCreate={handleFolderCreation} onClose={() => setIsCreatingFolder(false)} />
        )}
      </div>

      <div className={styles.evaluationGroupsContainer}>
        <Field
          label="Evaluation group"
          data-testid="group-picker"
          description="Rules within the same group are evaluated sequentially over the same time interval."
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
                        <ProvisioningBadge />
                      </>
                    )}
                  </div>
                )}
                placeholder={'Select an evaluation group...'}
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

        <div className={styles.addButton}>
          <span>or</span>
          <Button
            onClick={onOpenEvaluationGroupCreationModal}
            type="button"
            icon="plus"
            fill="outline"
            variant="secondary"
            disabled={!folder}
          >
            New evaluation group
          </Button>
        </div>
        {isCreatingEvaluationGroup && (
          <EvaluationGroupCreationModal
            onCreate={handleEvalGroupCreation}
            onClose={() => setIsCreatingEvaluationGroup(false)}
            groupfoldersForGrafana={groupfoldersForGrafana}
          />
        )}
      </div>
    </div>
  );
}

function FolderCreationModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (folder: Folder) => void;
}): React.ReactElement {
  const styles = useStyles2(getStyles);

  const [title, setTitle] = useState('');
  const onSubmit = async () => {
    const newFolder = await createFolder({ title: title });
    if (!newFolder.uid) {
      appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
      return;
    }

    const folder: Folder = { title: newFolder.title, uid: newFolder.uid };
    onCreate(folder);
    appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
  };

  const error = containsSlashes(title);

  return (
    <Modal className={styles.modal} isOpen={true} title={'New folder'} onDismiss={onClose} onClickBackdrop={onClose}>
      <div className={styles.modalTitle}>Create a new folder to store your rule</div>

      <form onSubmit={onSubmit}>
        <Field
          label={<Label htmlFor="folder">Folder name</Label>}
          error={"The folder name can't contain slashes"}
          invalid={error}
        >
          <Input
            autoFocus={true}
            id="folderName"
            placeholder="Enter a name"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            className={styles.formInput}
          />
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title || error}>
            Create
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}

function EvaluationGroupCreationModal({
  onClose,
  onCreate,
  groupfoldersForGrafana,
}: {
  onClose: () => void;
  onCreate: (group: string, evaluationInterval: string) => void;
  groupfoldersForGrafana?: RulerRulesConfigDTO | null;
}): React.ReactElement {
  const styles = useStyles2(getStyles);
  const onSubmit = () => {
    onCreate(getValues('group'), getValues('evaluateEvery'));
  };

  const { watch } = useFormContext<RuleFormValues>();

  const evaluateEveryId = 'eval-every-input';
  const [groupName, folderName] = watch(['group', 'folder.title']);

  const groupRules =
    (groupfoldersForGrafana && groupfoldersForGrafana[folderName]?.find((g) => g.name === groupName)?.rules) ?? [];

  const onCancel = () => {
    onClose();
  };

  const formAPI = useForm({
    defaultValues: { group: '', evaluateEvery: '' },
    mode: 'onChange',
    shouldFocusError: true,
  });

  const { register, handleSubmit, formState, getValues } = formAPI;

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={'New evaluation group'}
      onDismiss={onCancel}
      onClickBackdrop={onCancel}
    >
      <div className={styles.modalTitle}>Create a new evaluation group to use for this alert rule.</div>

      <FormProvider {...formAPI}>
        <form onSubmit={handleSubmit(() => onSubmit())}>
          <Field
            label={<Label htmlFor={'group'}>Evaluation group name</Label>}
            error={formState.errors.group?.message}
            invalid={!!formState.errors.group}
          >
            <Input
              className={styles.formInput}
              autoFocus={true}
              id={'group'}
              placeholder="Enter a name"
              {...register('group', { required: { value: true, message: 'Required.' } })}
            />
          </Field>

          <Field
            error={formState.errors.evaluateEvery?.message}
            invalid={!!formState.errors.evaluateEvery}
            label={
              <Label
                htmlFor={evaluateEveryId}
                description="How often is the rule evaluated. Applies to every rule within the group."
              >
                Evaluation interval
              </Label>
            }
          >
            <Input
              className={styles.formInput}
              id={evaluateEveryId}
              placeholder="e.g. 5m"
              {...register('evaluateEvery', evaluateEveryValidationOptions(groupRules))}
            />
          </Field>
          <Modal.ButtonRow>
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formState.isValid}>
              Create
            </Button>
          </Modal.ButtonRow>
        </form>
      </FormProvider>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-direction: column;
    align-items: baseline;
    max-width: ${theme.breakpoints.values.lg}px;
    justify-content: space-between;
  `,
  evaluationGroupsContainer: css`
    width: 100%;
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(2)};
  `,

  addButton: css`
    display: flex;
    direction: row;
    gap: ${theme.spacing(2)};
    line-height: 2;
    margin-top: 35px;
  `,
  formInput: css`
    max-width: ${theme.breakpoints.values.sm}px;
    flex-grow: 1;

    label {
      width: ${theme.breakpoints.values.sm}px;
    }
  `,

  modal: css`
    width: ${theme.breakpoints.values.sm}px;
  `,

  modalTitle: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(2)};
  `,
});
