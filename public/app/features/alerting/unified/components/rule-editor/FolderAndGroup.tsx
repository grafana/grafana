import { css } from '@emotion/css';
import { debounce, take, uniqueId } from 'lodash';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AsyncSelect, Box, Button, Field, Input, Label, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { useNewFolderMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { AccessControlAction } from 'app/types';
import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { Folder, RuleFormValues } from '../../types/rule-form';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../utils/rule-form';
import { isGrafanaRecordingRuleByType, isGrafanaRulerRule } from '../../utils/rules';
import { ProvisioningBadge } from '../Provisioning';
import { evaluateEveryValidationOptions } from '../rules/EditRuleGroupModal';

import { EvaluationGroupQuickPick } from './EvaluationGroupQuickPick';

export const MAX_GROUP_RESULTS = 1000;

export const useFolderGroupOptions = (folderUid: string, enableProvisionedGroups: boolean) => {
  // fetch the ruler rules from the database so we can figure out what other "groups" are already defined
  // for our folders
  const { isLoading: isLoadingRulerNamespace, currentData: rulerNamespace } =
    alertRuleApi.endpoints.rulerNamespace.useQuery(
      {
        namespace: folderUid,
        rulerConfig: GRAFANA_RULER_CONFIG,
      },
      {
        skip: !folderUid,
        refetchOnMountOrArgChange: true,
      }
    );

  // There should be only one entry in the rulerNamespace object
  // However it uses folder name as key, so to avoid fetching folder name, we use Object.values
  const groupOptions = useMemo(() => {
    if (!rulerNamespace) {
      // still waiting for namespace information to be fetched
      return [];
    }

    const folderGroups = Object.values(rulerNamespace).flat() ?? [];

    return folderGroups
      .map<SelectableValue<string>>((group) => {
        const isProvisioned = isProvisionedGroup(group);
        return {
          label: group.name,
          value: group.name,
          description: group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
          // we include provisioned folders, but disable the option to select them
          isDisabled: !enableProvisionedGroups ? isProvisioned : false,
          isProvisioned: isProvisioned,
        };
      })

      .sort(sortByLabel);
  }, [rulerNamespace, enableProvisionedGroups]);

  return { groupOptions, loading: isLoadingRulerNamespace };
};

const isProvisionedGroup = (group: RulerRuleGroupDTO) => {
  return group.rules.some((rule) => isGrafanaRulerRule(rule) && Boolean(rule.grafana_alert.provenance) === true);
};

const sortByLabel = (a: SelectableValue<string>, b: SelectableValue<string>) => {
  return a.label?.localeCompare(b.label ?? '') || 0;
};

const findGroupMatchingLabel = (group: SelectableValue<string>, query: string) => {
  return group.label?.toLowerCase().includes(query.toLowerCase());
};

export function FolderAndGroup({
  groupfoldersForGrafana,
  enableProvisionedGroups,
}: {
  groupfoldersForGrafana?: RulerRulesConfigDTO | null;
  enableProvisionedGroups: boolean;
}) {
  const {
    formState: { errors },
    watch,
    setValue,
    control,
  } = useFormContext<RuleFormValues>();

  const styles = useStyles2(getStyles);

  const [folder, group, type] = watch(['folder', 'group', 'type']);
  const isGrafanaRecordingRule = type ? isGrafanaRecordingRuleByType(type) : false;

  const { groupOptions, loading } = useFolderGroupOptions(folder?.uid ?? '', enableProvisionedGroups);

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

  const evaluationDesc = isGrafanaRecordingRule
    ? t('alerting.folderAndGroup.evaluation.text.recording', 'Define how often the recording rule is evaluated.')
    : t('alerting.folderAndGroup.evaluation.text.alerting', 'Define how often the alert rule is evaluated.');

  return (
    <div className={styles.container}>
      <Stack alignItems="center">
        {
          <Field
            label={
              <Label htmlFor="folder" description={'Select a folder to store your rule.'}>
                Folder
              </Label>
            }
            className={styles.formInput}
            error={errors.folder?.message}
            data-testid="folder-picker"
          >
            <Stack direction="row" alignItems="center">
              {(!isCreatingFolder && (
                <>
                  <Controller
                    render={({ field: { ref, ...field } }) => (
                      <div style={{ width: 420 }}>
                        <NestedFolderPicker
                          showRootFolder={false}
                          invalid={!!errors.folder?.message}
                          {...field}
                          value={folder?.uid}
                          onChange={(uid, title) => {
                            if (uid && title) {
                              setValue('folder', { title, uid });
                            } else {
                              setValue('folder', undefined);
                            }

                            resetGroup();
                          }}
                        />
                      </div>
                    )}
                    name="folder"
                    rules={{
                      required: { value: true, message: 'Select a folder' },
                    }}
                  />
                  <Text color="secondary">or</Text>
                  <Button
                    onClick={onOpenFolderCreationModal}
                    type="button"
                    icon="plus"
                    fill="outline"
                    variant="secondary"
                    disabled={!contextSrv.hasPermission(AccessControlAction.FoldersCreate)}
                    data-testid={selectors.components.AlertRules.newFolderButton}
                  >
                    New folder
                  </Button>
                </>
              )) || <div>Creating new folder...</div>}
            </Stack>
          </Field>
        }
        {isCreatingFolder && (
          <FolderCreationModal onCreate={handleFolderCreation} onClose={() => setIsCreatingFolder(false)} />
        )}
      </Stack>

      <Stack alignItems="center">
        <div style={{ width: 420 }}>
          <Field
            label="Evaluation group and interval"
            data-testid="group-picker"
            description={evaluationDesc}
            className={styles.formInput}
            error={errors.group?.message}
            invalid={!!errors.group?.message}
            htmlFor="group"
          >
            <Controller
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
                      {option.isProvisioned && (
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
              }}
            />
          </Field>
        </div>
        <Box marginTop={4} gap={1} display={'flex'} alignItems={'center'}>
          <Text color="secondary">or</Text>
          <Button
            onClick={onOpenEvaluationGroupCreationModal}
            type="button"
            icon="plus"
            fill="outline"
            variant="secondary"
            disabled={!folder}
            data-testid={selectors.components.AlertRules.newEvaluationGroupButton}
          >
            New evaluation group
          </Button>
        </Box>
        {isCreatingEvaluationGroup && (
          <EvaluationGroupCreationModal
            onCreate={handleEvalGroupCreation}
            onClose={() => setIsCreatingEvaluationGroup(false)}
            groupfoldersForGrafana={groupfoldersForGrafana}
          />
        )}
      </Stack>
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

  const notifyApp = useAppNotification();
  const [title, setTitle] = useState('');
  const [createFolder] = useNewFolderMutation();

  const onSubmit = async () => {
    const { data, error } = await createFolder({ title });

    if (error) {
      notifyApp.error('Failed to create folder');
    } else if (data) {
      onCreate({ title: data.title, uid: data.uid });
      notifyApp.success('Folder created');
    }
  };

  return (
    <Modal className={styles.modal} isOpen={true} title={'New folder'} onDismiss={onClose} onClickBackdrop={onClose}>
      <div className={styles.modalTitle}>Create a new folder to store your rule</div>

      <form onSubmit={onSubmit}>
        <Field label={<Label htmlFor="folder">Folder name</Label>}>
          <Input
            data-testid={selectors.components.AlertRules.newFolderNameField}
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
          <Button
            type="submit"
            disabled={!title}
            data-testid={selectors.components.AlertRules.newFolderNameCreateButton}
          >
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
  const evaluationGroupNameId = 'new-eval-group-name';
  const [groupName, folderName, type] = watch(['group', 'folder.title', 'type']);
  const isGrafanaRecordingRule = type ? isGrafanaRecordingRuleByType(type) : false;

  const groupRules =
    (groupfoldersForGrafana && groupfoldersForGrafana[folderName]?.find((g) => g.name === groupName)?.rules) ?? [];

  const onCancel = () => {
    onClose();
  };

  const formAPI = useForm({
    defaultValues: { group: '', evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL },
    mode: 'onChange',
    shouldFocusError: true,
  });

  const { register, handleSubmit, formState, setValue, getValues, watch: watchGroupFormValues } = formAPI;
  const evaluationInterval = watchGroupFormValues('evaluateEvery');

  const setEvaluationInterval = (interval: string) => {
    setValue('evaluateEvery', interval, { shouldValidate: true });
  };

  const modalTitle = isGrafanaRecordingRule
    ? t(
        'alerting.folderAndGroup.evaluation.modal.text.recording',
        'Create a new evaluation group to use for this recording rule.'
      )
    : t(
        'alerting.folderAndGroup.evaluation.modal.text.alerting',
        'Create a new evaluation group to use for this alert rule.'
      );

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={'New evaluation group'}
      onDismiss={onCancel}
      onClickBackdrop={onCancel}
    >
      <div className={styles.modalTitle}>{modalTitle}</div>

      <FormProvider {...formAPI}>
        <form onSubmit={handleSubmit(() => onSubmit())}>
          <Field
            label={
              <Label
                htmlFor={evaluationGroupNameId}
                description="A group evaluates all its rules over the same evaluation interval."
              >
                Evaluation group name
              </Label>
            }
            error={formState.errors.group?.message}
            invalid={Boolean(formState.errors.group)}
          >
            <Input
              data-testid={selectors.components.AlertRules.newEvaluationGroupName}
              className={styles.formInput}
              autoFocus={true}
              id={evaluationGroupNameId}
              placeholder="Enter a name"
              {...register('group', { required: { value: true, message: 'Required.' } })}
            />
          </Field>

          <Field
            error={formState.errors.evaluateEvery?.message}
            label={
              <Label htmlFor={evaluateEveryId} description="How often all rules in the group are evaluated.">
                Evaluation interval
              </Label>
            }
            invalid={Boolean(formState.errors.evaluateEvery)}
          >
            <Input
              data-testid={selectors.components.AlertRules.newEvaluationGroupInterval}
              className={styles.formInput}
              id={evaluateEveryId}
              placeholder={DEFAULT_GROUP_EVALUATION_INTERVAL}
              {...register(
                'evaluateEvery',
                evaluateEveryValidationOptions<{ group: string; evaluateEvery: string }>(groupRules)
              )}
            />
          </Field>

          <EvaluationGroupQuickPick currentInterval={evaluationInterval} onSelect={setEvaluationInterval} />

          <Modal.ButtonRow>
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formState.isValid}
              data-testid={selectors.components.AlertRules.newEvaluationGroupCreate}
            >
              Create
            </Button>
          </Modal.ButtonRow>
        </form>
      </FormProvider>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'baseline',
    maxWidth: `${theme.breakpoints.values.lg}px`,
    justifyContent: 'space-between',
  }),
  formInput: css({
    flexGrow: 1,
  }),
  modal: css({
    width: `${theme.breakpoints.values.sm}px`,
  }),
  modalTitle: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
