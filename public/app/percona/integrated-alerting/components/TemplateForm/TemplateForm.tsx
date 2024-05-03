import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, Select } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { FolderAndGroup } from 'app/features/alerting/unified/components/rule-editor/FolderAndGroup';
import { fetchExternalAlertmanagersConfigAction } from 'app/features/alerting/unified/state/actions';
import { initialAsyncRequestState } from 'app/features/alerting/unified/utils/redux';
import { durationValidationPattern, parseDurationToMilliseconds } from 'app/features/alerting/unified/utils/time';
import {
  Template,
  TemplateParamType,
} from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { fetchTemplatesAction } from 'app/percona/shared/core/reducers';
import { getTemplates } from 'app/percona/shared/core/selectors';
import { useDispatch, useSelector } from 'app/types';

import { TemplatedAlertFormValues } from '../../types';

import { AdvancedRuleSection } from './AdvancedRuleSection/AdvancedRuleSection';
import { EvaluateEvery } from './EvaluateEvery/EvaluateEvery';
import TemplateFiltersField from './TemplateFiltersField';
import { SEVERITY_OPTIONS } from './TemplateForm.constants';
import { Messages } from './TemplateForm.messages';
import { formatTemplateOptions } from './TemplateForm.utils';

export const TemplateForm: FC = () => {
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<TemplatedAlertFormValues>();
  const dispatch = useDispatch();
  const templates = useRef<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Template>();
  const [queryParams] = useQueryParams();
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
  const selectedTemplate: string | null = (queryParams['template'] as string | undefined) || null;

  const { result: templatesResult, loading: templatesLoading } = useSelector(getTemplates) || initialAsyncRequestState;
  const templateOptions = formatTemplateOptions(templatesResult?.templates || []);
  templates.current = templatesResult?.templates || [];

  const setRuleNameAfterTemplate = useCallback(
    (template?: Template) => {
      const value = getValues('ruleName');
      const valueExists = templates.current.find((opt) => value === `${opt.name} Alerting Rule`);
      if (valueExists || !value) {
        setValue('ruleName', `${template?.name} Alerting Rule`);
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
      await dispatch(fetchExternalAlertmanagersConfigAction());
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
    <>
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
        error={errors.ruleName?.message}
        invalid={!!errors.ruleName?.message}
      >
        <Input id="ruleName" {...register('ruleName', { required: { value: true, message: Messages.errors.name } })} />
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

      <FolderAndGroup enableProvisionedGroups />

      <EvaluateEvery />

      <TemplateFiltersField />

      {currentTemplate && (
        <AdvancedRuleSection expression={currentTemplate.expr} summary={currentTemplate.annotations?.summary} />
      )}
    </>
  );
};
