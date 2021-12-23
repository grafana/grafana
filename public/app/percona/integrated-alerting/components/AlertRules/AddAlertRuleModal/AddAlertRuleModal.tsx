import React, { FC, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Form, Field } from 'react-final-form';
import { Button, HorizontalGroup, Switch, useStyles } from '@grafana/ui';
import {
  Modal,
  LoaderButton,
  TextInputField,
  NumberInputField,
  TextareaInputField,
  logger,
  validators,
} from '@percona/platform-core';
import { AppEvents, SelectableValue } from '@grafana/data';
import { Label } from 'app/percona/shared/components/Form/Label';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { Messages } from './AddAlertRuleModal.messages';
import { AddAlertRuleModalProps, AddAlertRuleFormValues } from './AddAlertRuleModal.types';
import { getStyles } from './AddAlertRuleModal.styles';
import { SEVERITY_OPTIONS, MINIMUM_DURATION_VALUE } from './AddAlertRulesModal.constants';
import {
  formatTemplateOptions,
  formatChannelsOptions,
  formatCreateAPIPayload,
  formatUpdateAPIPayload,
  getInitialValues,
  minValidator,
} from './AddAlertRuleModal.utils';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesService } from '../AlertRules.service';
import { AlertRuleTemplateService } from '../../AlertRuleTemplate/AlertRuleTemplate.service';
import { Template, TemplateParamType } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { NotificationChannelService } from '../../NotificationChannel/NotificationChannel.service';
import { appEvents } from 'app/core/core';
import { AdvancedRuleSection } from './AdvancedRuleSection/AdvancedRuleSection';
import { AlertRuleParamField } from '../AlertRuleParamField';

const { required } = validators;
const durationValidators = [required, minValidator(MINIMUM_DURATION_VALUE)];
const nameValidators = [required];

export const AddAlertRuleModal: FC<AddAlertRuleModalProps> = ({ isVisible, setVisible, alertRule }) => {
  const styles = useStyles(getStyles);
  const [templateOptions, setTemplateOptions] = useState<Array<SelectableValue<string>>>();
  const [channelsOptions, setChannelsOptions] = useState<Array<SelectableValue<string>>>();
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
        }}
        render={({ handleSubmit, valid, pristine, submitting, form }) => (
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

            <TextareaInputField label={Messages.filtersField} name="filters" tooltipText={Messages.tooltips.filters} />

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

            {currentTemplate ? (
              <AdvancedRuleSection expression={currentTemplate.expr} summary={currentTemplate.annotations?.summary} />
            ) : (
              alertRule && (
                <AdvancedRuleSection
                  expression={alertRule.rawValues.expr_template}
                  summary={alertRule.rawValues.annotations?.summary}
                />
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
