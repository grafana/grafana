import React, { FC } from 'react';
import { Form } from 'react-final-form';

import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { WarningBlock } from 'app/percona/shared/components/Elements/WarningBlock';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';

import { MAX_TITLE_LENGTH } from './EditAlertRuleTemplateModal.constants';
import { Messages } from './EditAlertRuleTemplateModal.messages';
import { getStyles } from './EditAlertRuleTemplateModal.styles';
import { EditAlertRuleTemplateModalProps, EditAlertRuleTemplateRenderProps } from './EditAlertRuleTemplateModal.types';

export const EditAlertRuleTemplateModal: FC<React.PropsWithChildren<EditAlertRuleTemplateModalProps>> = ({
  yaml,
  name,
  summary,
  isVisible,
  setVisible,
  getAlertRuleTemplates,
}) => {
  const styles = useStyles(getStyles);
  const { required } = validators;
  let truncatedTitle = summary.length > MAX_TITLE_LENGTH ? `${summary.substring(0, MAX_TITLE_LENGTH - 3)}...` : summary;
  const onSubmit = async (values: EditAlertRuleTemplateRenderProps) => {
    try {
      await AlertRuleTemplateService.update({ ...values, name });
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.editSuccess]);
      getAlertRuleTemplates();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <Modal title={Messages.getTitle(truncatedTitle)} isVisible={isVisible} onClose={() => setVisible(false)}>
      <Form
        initialValues={{ yaml }}
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting }) => (
          <form onSubmit={handleSubmit} data-testid="edit-alert-rule-template-form">
            <>
              <TextareaInputField
                fieldClassName={styles.field}
                name="yaml"
                label={Messages.alertRuleTemplateLabel}
                validators={[required]}
                className={styles.alertRuleTemplate}
              />
              <WarningBlock message={Messages.nameNotEditable} type="warning" dataTestId="alert-rule-name-warning" />
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-testid="alert-rule-template-edit-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                  type="submit"
                >
                  {Messages.submitButton}
                </LoaderButton>
                <Button
                  data-testid="alert-rule-template-cancel-button"
                  variant="secondary"
                  onClick={() => setVisible(false)}
                >
                  {Messages.cancelAction}
                </Button>
              </HorizontalGroup>
            </>
          </form>
        )}
      />
    </Modal>
  );
};
