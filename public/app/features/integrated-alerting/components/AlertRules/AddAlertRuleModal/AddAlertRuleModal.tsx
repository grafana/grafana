import React, { FC, useContext, useEffect, useState } from 'react';
import { Form, Field } from 'react-final-form';
import { Button, HorizontalGroup, Switch, Select, MultiSelect, useStyles } from '@grafana/ui';
import {
  Modal,
  LoaderButton,
  TextInputField,
  NumberInputField,
  TextareaInputField,
  logger,
  validators,
} from '@percona/platform-core';
import { SelectableValue } from '@grafana/data';
import { AppEvents } from '@grafana/data';
import { Messages } from './AddAlertRuleModal.messages';
import { AddAlertRuleModalProps, AddAlertRuleFormValues } from './AddAlertRuleModal.types';
import { getStyles } from './AddAlertRuleModal.styles';
import { SEVERITY_OPTIONS } from './AddAlertRulesModal.constants';
import {
  formatTemplateOptions,
  formatChannelsOptions,
  formatCreateAPIPayload,
  formatUpdateAPIPayload,
  getInitialValues,
} from './AddAlertRuleModal.utils';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesService } from '../AlertRules.service';
import { AlertRuleTemplateService } from '../../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../../NotificationChannel/NotificationChannel.service';
import { appEvents } from 'app/core/core';

const { required } = validators;

export const AddAlertRuleModal: FC<AddAlertRuleModalProps> = ({ isVisible, setVisible, alertRule }) => {
  const styles = useStyles(getStyles);
  const [templateOptions, setTemplateOptions] = useState<Array<SelectableValue<string>>>();
  const [channelsOptions, setChannelsOptions] = useState<Array<SelectableValue<string>>>();
  const { getAlertRules } = useContext(AlertRulesProvider);

  const getData = async () => {
    try {
      const [channelsListResponse, templatesListResponse] = await Promise.all([
        NotificationChannelService.list(),
        AlertRuleTemplateService.list(),
      ]);
      setChannelsOptions(formatChannelsOptions(channelsListResponse));
      setTemplateOptions(formatTemplateOptions(templatesListResponse.templates));
    } catch (e) {
      logger.error(e);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  const initialValues = getInitialValues(alertRule);

  const onSubmit = async (values: AddAlertRuleFormValues) => {
    try {
      if (alertRule) {
        await AlertRulesService.update(formatUpdateAPIPayload(alertRule.rawValues.rule_id, values));
      } else {
        await AlertRulesService.create(formatCreateAPIPayload(values));
      }
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [alertRule ? Messages.updateSuccess : Messages.createSuccess]);
      getAlertRules();
    } catch (e) {
      logger.error(e);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <Modal
      title={alertRule ? Messages.editRuleTitle : Messages.addRuleTitle}
      isVisible={isVisible}
      onClose={handleClose}
      data-qa="add-alert-rule-modal"
    >
      <Form
        initialValues={initialValues}
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting }) => (
          <form className={styles.form} onSubmit={handleSubmit} data-qa="add-alert-rule-modal-form">
            {alertRule ? null : (
              <>
                <Field name="template" validate={required}>
                  {({ input }) => (
                    <>
                      <label className={styles.label} data-qa="template-select-label">
                        {Messages.templateField}
                      </label>
                      <Select
                        className={styles.select}
                        options={templateOptions}
                        {...input}
                        data-qa="template-select-input"
                      />
                    </>
                  )}
                </Field>

                <TextInputField label={Messages.nameField} name="name" validators={[required]} />
              </>
            )}

            <TextInputField label={Messages.thresholdField} name="threshold" />

            <NumberInputField label={Messages.durationField} name="duration" validators={[required]} />

            <Field name="severity" validate={required}>
              {({ input }) => (
                <>
                  <label className={styles.label} data-qa="severity-select-label">
                    {Messages.severityField}
                  </label>
                  <Select
                    className={styles.select}
                    options={SEVERITY_OPTIONS}
                    {...input}
                    data-qa="severity-multiselect-input"
                  />
                </>
              )}
            </Field>

            <TextareaInputField label={Messages.filtersField} name="filters" />

            <Field name="notificationChannels">
              {({ input }) => (
                <>
                  <label className={styles.label} data-qa="notification-channel-select-label">
                    {Messages.channelField}
                  </label>
                  <MultiSelect
                    className={styles.select}
                    options={channelsOptions}
                    {...input}
                    data-qa="notificationChannels-multiselect-input"
                  />
                </>
              )}
            </Field>

            <Field name="enabled" type="checkbox" defaultValue={true}>
              {({ input }) => (
                <>
                  <label className={styles.label} data-qa="enabled-toggle-label">
                    {Messages.activateSwitch}
                  </label>
                  <Switch {...input} value={input.checked} data-qa="enabled-toggle-input" />
                </>
              )}
            </Field>

            <div className={styles.actionsWrapper}>
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-qa="add-alert-rule-modal-add-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                >
                  {alertRule ? Messages.update : Messages.create}
                </LoaderButton>
                <Button
                  data-qa="add-alert-rule-modal-cancel-button"
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
