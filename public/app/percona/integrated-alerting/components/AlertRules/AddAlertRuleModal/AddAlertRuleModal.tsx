import { Modal, LoaderButton, TextInputField, NumberInputField, logger, validators } from '@percona/platform-core';
import arrayMutators from 'final-form-arrays';
import React, { FC, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Form, Field } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';

import { AppEvents, SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, Icon, Switch, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { Label } from 'app/percona/shared/components/Form/Label';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';

import { AlertRuleTemplateService } from '../../AlertRuleTemplate/AlertRuleTemplate.service';
import { Template, TemplateParamType } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { NotificationChannelService } from '../../NotificationChannel/NotificationChannel.service';
import { AlertRuleParamField } from '../AlertRuleParamField';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesService } from '../AlertRules.service';
import { AlertRuleFilterType } from '../AlertRules.types';

import { Messages } from './AddAlertRuleModal.messages';
import { getStyles } from './AddAlertRuleModal.styles';
import { AddAlertRuleFormValues, AddAlertRuleModalProps } from './AddAlertRuleModal.types';
import {
  formatTemplateOptions,
  formatChannelsOptions,
  formatCreateAPIPayload,
  formatUpdateAPIPayload,
  getInitialValues,
  minValidator,
} from './AddAlertRuleModal.utils';
import { SEVERITY_OPTIONS, MINIMUM_DURATION_VALUE } from './AddAlertRulesModal.constants';
import { AdvancedRuleSection } from './AdvancedRuleSection/AdvancedRuleSection';

const { required } = validators;
const durationValidators = [required, minValidator(MINIMUM_DURATION_VALUE)];
const nameValidators = [required];
const filterTextFieldsValidators = [required];

export const AddAlertRuleModal: FC<AddAlertRuleModalProps> = ({ isVisible, setVisible, alertRule }) => {
  const styles = useStyles2(getStyles);
  const [templateOptions, setTemplateOptions] = useState<Array<SelectableValue<string>>>();
  const [channelsOptions, setChannelsOptions] = useState<Array<SelectableValue<string>>>();

  const filterOptions: Array<SelectableValue<AlertRuleFilterType>> = useMemo(
    () =>
      Object.entries(AlertRuleFilterType).map(([key, value]) => ({
        label: `${value} (${key})`,
        value: value,
      })),
    []
  );
  const templates = useRef<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Template>();
  const { getAlertRules, setSelectedAlertRule } = useContext(AlertRulesProvider);

  const updateAlertRuleTemplateParams = useCallback(() => {
    setCurrentTemplate(templates.current.find((template) => template.name === alertRule?.rawValues.template_name));
  }, [alertRule?.rawValues.template_name]);

  const getData = useCallback(async () => {
    try {
      const [channelsListResponse, templatesListResponse] = await Promise.all([
        NotificationChannelService.list({
          page_params: {
            index: 0,
            page_size: 100,
          },
        }),
        AlertRuleTemplateService.list({
          page_params: {
            index: 0,
            page_size: 100,
          },
        }),
      ]);
      setChannelsOptions(formatChannelsOptions(channelsListResponse.channels));
      setTemplateOptions(formatTemplateOptions(templatesListResponse.templates));
      templates.current = templatesListResponse.templates;
      updateAlertRuleTemplateParams();
    } catch (e) {
      logger.error(e);
    }
  }, [updateAlertRuleTemplateParams]);

  useEffect(() => {
    getData();
  }, [getData]);

  useEffect(() => {
    updateAlertRuleTemplateParams();
  }, [alertRule, updateAlertRuleTemplateParams]);

  const initialValues = getInitialValues(alertRule);
  const onSubmit = async (values: AddAlertRuleFormValues) => {
    try {
      if (alertRule) {
        await AlertRulesService.update(formatUpdateAPIPayload(alertRule.rawValues.rule_id, values, alertRule.params));
      } else {
        await AlertRulesService.create(formatCreateAPIPayload(values, currentTemplate?.params));
      }
      appEvents.emit(AppEvents.alertSuccess, [alertRule ? Messages.updateSuccess : Messages.createSuccess]);
      getAlertRules();
      setVisible(false);
      setSelectedAlertRule(null);
    } catch (e) {
      logger.error(e);
    }
  };

  const handleClose = () => {
    setCurrentTemplate(undefined);
    setSelectedAlertRule(null);
    setVisible(false);
  };

  const handleTemplateChange = (name = ''): Template | undefined => {
    const template = templates.current.find((template) => template.name === name);
    setCurrentTemplate(template);

    return template;
  };

  return (
    <Modal
      title={alertRule ? Messages.editRuleTitle : Messages.addRuleTitle}
      isVisible={isVisible}
      onClose={handleClose}
      data-testid="add-alert-rule-modal"
    >
      <Form
        initialValues={initialValues}
        onSubmit={onSubmit}
        mutators={{
          changeSeverity: ([templateName], state, tools) => {
            const severityStr = templates.current.find((template) => template.name === templateName)?.severity;
            const newSeverity = SEVERITY_OPTIONS.find((severity) => severity.value === severityStr);

            if (newSeverity) {
              // TODO since editing the template name is not allowed so far, no need to keep previous option.
              // When edition is allowed, the function param below can take the old value as argument, thus we can keep the selection
              // before changing it, e.g. "(oldSeverity) => oldSeverity | newSeverity"
              tools.changeValue(state, 'severity', () => newSeverity);
            }
          },
          changeDuration: ([templateName], state, tools) => {
            const newDuration = templates.current.find((template) => template.name === templateName)?.for;
            tools.changeValue(state, 'duration', () => (newDuration ? parseInt(newDuration, 10) : undefined));
          },
          changeParam: ([paramName, paramValue], state, tools) => {
            tools.changeValue(state, paramName, () => paramValue);
          },
          ...arrayMutators,
        }}
        render={({
          handleSubmit,
          valid,
          pristine,
          submitting,
          form: {
            mutators: { push },
          },
          form,
        }) => (
          <form className={styles.form} onSubmit={handleSubmit} data-testid="add-alert-rule-modal-form">
            <Field name="template" validate={required}>
              {({ input }) => (
                <SelectField
                  label={Messages.templateField}
                  disabled={!!alertRule}
                  tooltipText={Messages.tooltips.template}
                  options={templateOptions}
                  {...input}
                  onChange={(name) => {
                    form.mutators.changeSeverity(name.value);
                    form.mutators.changeDuration(name.value);
                    const newTemplate = handleTemplateChange(name.value);

                    if (newTemplate) {
                      newTemplate.params?.forEach(({ type, float, name }) => {
                        // TODO add missing types when supported
                        if (type === TemplateParamType.FLOAT && float?.default !== undefined) {
                          form.mutators.changeParam(name, float.default);
                        }
                      });
                    }
                    input.onChange(name);
                  }}
                  data-testid="template-select-input"
                />
              )}
            </Field>

            <TextInputField
              label={Messages.nameField}
              name="name"
              validators={nameValidators}
              tooltipText={Messages.tooltips.name}
            />

            {alertRule
              ? alertRule.params.map((param) => <AlertRuleParamField key={param.name} param={param} />)
              : currentTemplate?.params?.map((param) => <AlertRuleParamField key={param.name} param={param} />)}

            <NumberInputField
              label={Messages.durationField}
              name="duration"
              validators={durationValidators}
              tooltipText={Messages.tooltips.duration}
            />

            <Field name="severity" validate={required}>
              {({ input }) => (
                <SelectField
                  label={Messages.severityField}
                  options={SEVERITY_OPTIONS}
                  tooltipText={Messages.tooltips.severity}
                  {...input}
                  data-testid="severity-select-input"
                />
              )}
            </Field>
            <div className={styles.filtersLabelWrapper}>
              <Label label={Messages.filter.header} dataTestId="filters-field-label" />
              <LinkTooltip tooltipText={Messages.tooltips.filters} icon="info-circle" />
            </div>

            <Button
              className={styles.filterButton}
              variant="secondary"
              type="button"
              onClick={() => push('filters')}
              data-testid="add-filter-button"
            >
              {Messages.filter.addButton}
            </Button>
            <FieldArray name="filters">
              {({ fields }) =>
                fields.map((name, index) => (
                  <div key={name} className={styles.filterRowWrapper} data-testid="filter-fields-row">
                    <div className={styles.filterFields}>
                      <TextInputField
                        label={Messages.filter.fieldLabel}
                        name={`${name}.label`}
                        validators={filterTextFieldsValidators}
                      />
                    </div>

                    <div className={styles.filterFields}>
                      <Field name={`${name}.operators`} validate={required}>
                        {({ input }) => (
                          <SelectField
                            className={styles.selectField}
                            label={Messages.filter.fieldOperators}
                            options={filterOptions}
                            {...input}
                          />
                        )}
                      </Field>
                    </div>
                    <div className={styles.filterFields}>
                      <TextInputField
                        label={Messages.filter.fieldValue}
                        name={`${name}.value`}
                        validators={filterTextFieldsValidators}
                      />
                    </div>
                    <div className={styles.iconWrapper}>
                      <Icon
                        className={styles.icon}
                        onClick={() => fields.remove(index)}
                        name="trash-alt"
                        size="xl"
                        data-testid="delete-filter-button"
                      />
                    </div>
                  </div>
                ))
              }
            </FieldArray>

            <Field name="notificationChannels">
              {({ input }) => (
                <MultiSelectField
                  label={Messages.channelField}
                  options={channelsOptions}
                  tooltipText={Messages.tooltips.channels}
                  {...input}
                  data-testid="notificationChannels-multiselect-input"
                />
              )}
            </Field>

            {alertRule ? (
              <AdvancedRuleSection
                expression={alertRule.rawValues.expr_template}
                summary={alertRule.rawValues.annotations?.summary}
              />
            ) : (
              currentTemplate && (
                <AdvancedRuleSection expression={currentTemplate.expr} summary={currentTemplate.annotations?.summary} />
              )
            )}

            <Field name="enabled" type="checkbox" defaultValue={true}>
              {({ input }) => (
                <div className={styles.toogleField}>
                  <Label label={Messages.activateSwitch} dataTestId="enabled-toggle-label" />
                  <Switch {...input} value={input.checked} data-testid="enabled-toggle-input" />
                </div>
              )}
            </Field>

            <div className={styles.actionsWrapper}>
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-testid="add-alert-rule-modal-add-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                >
                  {alertRule ? Messages.update : Messages.create}
                </LoaderButton>
                <Button
                  data-testid="add-alert-rule-modal-cancel-button"
                  variant="secondary"
                  onClick={() => setVisible(false)}
                >
                  {Messages.cancel}
                </Button>
              </HorizontalGroup>
            </div>
          </form>
        )}
      />
    </Modal>
  );
};
