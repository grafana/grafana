import React, { FC } from 'react';
import { Form } from 'react-final-form';
import { HorizontalGroup, useStyles } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { Modal, LoaderButton, TextareaInputField, validators, logger } from '@percona/platform-core';
import { appEvents } from 'app/core/app_events';
import { EditAlertRuleTemplateModalProps, EditAlertRuleTemplateRenderProps } from './EditAlertRuleTemplateModal.types';
import { getStyles } from './EditAlertRuleTemplateModal.styles';
import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';
import { Messages } from './EditAlertRuleTemplateModal.messages';

export const EditAlertRuleTemplateModal: FC<EditAlertRuleTemplateModalProps> = ({
  yaml,
  isVisible,
  setVisible,
  getAlertRuleTemplates,
}) => {
  const styles = useStyles(getStyles);
  const { required } = validators;
  const onSubmit = async (values: EditAlertRuleTemplateRenderProps) => {
    try {
      await AlertRuleTemplateService.update(values);
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.editSuccess]);
      getAlertRuleTemplates();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <Modal title={Messages.title} isVisible={isVisible} onClose={() => setVisible(false)}>
      <Form
        initialValues={{ yaml }}
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting }) => (
          <form onSubmit={handleSubmit}>
            <>
              <TextareaInputField
                name="yaml"
                label={Messages.alertRuleTemplateLabel}
                validators={[required]}
                className={styles.alertRuleTemplate}
              />
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-qa="alert-rule-template-edit-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                >
                  {Messages.submitButton}
                </LoaderButton>
              </HorizontalGroup>
            </>
          </form>
        )}
      />
    </Modal>
  );
};
