import React, { FC, useEffect, useRef, useState, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Stack } from '@grafana/experimental';
import { Field, Icon, Input, InputControl, Label, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { FolderPickerFilter } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { DashboardSearchHit } from 'app/features/search/types';
import {
  Template,
  TemplateParamType,
} from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { fetchTemplatesAction } from 'app/percona/shared/core/reducers';
import { getTemplates } from 'app/percona/shared/core/selectors';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';

import { fetchAlertManagerConfigAction } from '../../../state/actions';
import { RuleForm, RuleFormValues } from '../../../types/rule-form';
import { initialAsyncRequestState } from '../../../utils/redux';
import { durationValidationPattern, parseDurationToMilliseconds } from '../../../utils/time';
import { RuleEditorSection } from '../RuleEditorSection';
import { Folder, RuleFolderPicker } from '../RuleFolderPicker';
import { checkForPathSeparator } from '../util';

import { AdvancedRuleSection } from './AdvancedRuleSection/AdvancedRuleSection';
import TemplateFiltersField from './TemplateFiltersField';
import { SEVERITY_OPTIONS } from './TemplateStep.constants';
import { Messages } from './TemplateStep.messages';
import { getStyles } from './TemplateStep.styles';
import { formatTemplateOptions } from './TemplateStep.utils';

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
    (folderHits) => folderHits.filter(isSearchHitAvailable),
    [isSearchHitAvailable]
  );
};

export const TemplateStep: FC = () => {
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const dispatch = useDispatch();
  const templates = useRef<Template[]>([]);
  const styles = useStyles2(getStyles);
  const [currentTemplate, setCurrentTemplate] = useState<Template>();
  const [queryParams] = useQueryParams();
  const folderFilter = useRuleFolderFilter(null);
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
  const selectedTemplate: string | null = (queryParams['template'] as string | undefined) || null;

  const { result: templatesResult, loading: templatesLoading } = useSelector(getTemplates) || initialAsyncRequestState;
  const templateOptions = formatTemplateOptions(templatesResult?.templates || []);
  templates.current = templatesResult?.templates || [];

  const setRuleNameAfterTemplate = useCallback(
    (template?: Template) => {
      if (!getValues('name')) {
        setValue('name', `${template?.name} Alerting Rule`);
      }
    },
    [getValues, setValue]
  );

  const handleTemplateChange = useCallback(
    (selectedTemplate?: Template, onChange?: (template?: Template) => void) => {
      const newTemplate = templates.current.find((template) => template.name === selectedTemplate?.name);
      const severityStr = newTemplate?.severity;
      const newSeverity = SEVERITY_OPTIONS.find((severity) => severity.value === severityStr);

      setCurrentTemplate(newTemplate);
      if (newSeverity && newSeverity.value) {
        // @ts-ignore
        setValue('severity', newSeverity.value);
      }
      setValue('duration', newTemplate?.for || '1m');

      setRuleNameAfterTemplate(newTemplate);

      if (newTemplate) {
        newTemplate.params?.forEach(({ type, float, name }) => {
          // TODO add missing types when supported
          if (type === TemplateParamType.FLOAT && float?.default !== undefined) {
            // @ts-ignore
            setValue(name, float.default);
          }
        });
      }

      if (!!onChange) {
        onChange(selectedTemplate);
      }
    },
    [setRuleNameAfterTemplate, setValue]
  );

  useEffect(() => {
    const getData = async () => {
      dispatch(fetchAlertManagerConfigAction('grafana'));
      const { templates } = await dispatch(fetchTemplatesAction()).unwrap();

      if (selectedTemplate) {
        const matchingTemplate = templates.find((template) => template.name === selectedTemplate);

        if (matchingTemplate) {
          setValue('template', matchingTemplate);

          setRuleNameAfterTemplate(matchingTemplate);

          handleTemplateChange(matchingTemplate);
        }
      }
    };
    getData();
  }, [dispatch, handleTemplateChange, selectedTemplate, setRuleNameAfterTemplate, setValue]);

  return (
    <RuleEditorSection stepNo={2} title="Template details">
      <Field
        label={Messages.templateField}
        description={Messages.tooltips.template}
        error={errors.template?.message}
        invalid={!!errors.template?.message}
      >
        <Controller
          name="template"
          rules={{ required: { value: true, message: Messages.errors.template } }}
          render={({ field: { value, onChange } }) => (
            <Select
              id="template"
              isLoading={templatesLoading}
              disabled={templatesLoading}
              placeholder={templatesLoading ? Messages.loadingTemplates : undefined}
              value={templateOptions?.find((opt) => opt.value?.name === value?.name)}
              onChange={(selectedTemplate) => handleTemplateChange(selectedTemplate.value, onChange)}
              options={templateOptions}
              data-testid="template-select-input"
            />
          )}
        />
      </Field>
      <Field
        label={Messages.nameField}
        description={Messages.tooltips.name}
        error={errors.name?.message}
        invalid={!!errors.name?.message}
      >
        <Input id="name" {...register('name', { required: { value: true, message: Messages.errors.name } })} />
      </Field>

      {/* TODO add remaining params as API starts supporting them
      https://github.com/percona/pmm-managed/blob/PMM-2.0/models/template_model.go#L112 */}
      {currentTemplate?.params?.map(
        ({ float, type, name, summary, unit }) =>
          type === TemplateParamType.FLOAT && (
            <Field
              key={name}
              label={`${name[0].toUpperCase()}${name.slice(1)}`}
              description={Messages.getFloatDescription(summary, unit, float)}
              // @ts-ignore
              error={errors[name]?.message}
              // @ts-ignore
              invalid={!!errors[name]?.message}
            >
              <Input
                type="number"
                // @ts-ignore
                {...register(name, {
                  required: { value: true, message: Messages.errors.floatParamRequired(name) },
                  min: float?.hasMin
                    ? { value: float.min || 0, message: Messages.errors.floatParamMin(float.min || 0) }
                    : undefined,
                  max: float?.hasMax
                    ? { value: float.max || 0, message: Messages.errors.floatParamMax(float.max || 0) }
                    : undefined,
                })}
                name={name}
                defaultValue={`${float?.default}`}
              />
            </Field>
          )
      )}

      <Field
        label={Messages.durationField}
        description={Messages.tooltips.duration}
        error={errors.duration?.message}
        invalid={!!errors.duration?.message}
      >
        <Input
          id="duration"
          {...register('duration', {
            required: { value: true, message: Messages.errors.durationRequired },
            pattern: durationValidationPattern,
            validate: (value) => {
              const millisFor = parseDurationToMilliseconds(value);

              // 0 is a special value meaning for equals evaluation interval
              if (millisFor === 0) {
                return true;
              }

              return millisFor > 0 ? true : Messages.errors.durationMin;
            },
          })}
        />
      </Field>
      <Field
        label={Messages.severityField}
        description={Messages.tooltips.severity}
        error={errors.severity?.message}
        invalid={!!errors.severity?.message}
      >
        <Controller
          name="severity"
          rules={{ required: { value: true, message: Messages.errors.severity } }}
          render={({ field: { onChange, value } }) => (
            <Select
              value={value}
              onChange={(v) => onChange(v.value)}
              id="severity"
              options={SEVERITY_OPTIONS}
              data-testid="severity-select-input"
            />
          )}
        />
      </Field>

      <div className={styles.folderAndGroupSelect}>
        <Field
          label={
            <Label htmlFor="folder" description={'Select a folder to store your rule.'}>
              <Stack gap={0.5}>
                Folder
                <Tooltip
                  placement="top"
                  content={
                    <div>
                      Each folder has unique folder permission. When you store multiple rules in a folder, the folder
                      access permissions get assigned to the rules.
                    </div>
                  }
                >
                  <Icon name="info-circle" size="xs" />
                </Tooltip>
              </Stack>
            </Label>
          }
          className={styles.folderAndGroupInput}
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
              />
            )}
            name="folder"
            rules={{
              required: { value: true, message: 'Please select a folder' },
              validate: {
                pathSeparator: (folder: Folder) => checkForPathSeparator(folder.title),
              },
            }}
          />
        </Field>
        <Field
          label="Group"
          data-testid="group-picker"
          description="Rules within the same group are evaluated after the same time interval."
          className={styles.folderAndGroupInput}
          error={errors.group?.message}
          invalid={!!errors.group?.message}
        >
          <Input
            id="group"
            {...register('group', {
              required: { value: true, message: 'Must enter a group name' },
            })}
          />
        </Field>
      </div>

      <TemplateFiltersField />

      {currentTemplate && (
        <AdvancedRuleSection expression={currentTemplate.expr} summary={currentTemplate.annotations?.summary} />
      )}
    </RuleEditorSection>
  );
};
