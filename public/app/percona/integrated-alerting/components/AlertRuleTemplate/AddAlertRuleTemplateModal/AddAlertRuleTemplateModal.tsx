import { FormApi } from 'final-form';
import React, { ChangeEvent, FC, useCallback, useRef } from 'react';
import { Form } from 'react-final-form';

import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, Icon, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Messages } from 'app/percona/integrated-alerting/IntegratedAlerting.messages';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';

import { getStyles } from './AddAlertRuleTemplateModal.styles';
import { AddAlertRuleTemplateModalProps, AlertRuleTemplateRenderProps } from './AddAlertRuleTemplateModal.types';

export const AddAlertRuleTemplateModal: FC<React.PropsWithChildren<AddAlertRuleTemplateModalProps>> = ({
  isVisible,
  setVisible,
  getAlertRuleTemplates,
}) => {
  const styles = useStyles(getStyles);
  const { required } = validators;
  const inputRef = useRef<HTMLInputElement>(null);
  const onUploadFile = useCallback(
    (change: FormApi['change']) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;
      const reader = new FileReader();

      if (file) {
        reader.addEventListener('load', (e) => change('yaml', e.target?.result));
        reader.readAsText(file);
      }
    },
    []
  );
  const onSubmit = async (values: AlertRuleTemplateRenderProps) => {
    try {
      await AlertRuleTemplateService.upload(values);
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.alertRuleTemplate.addSuccess]);
      getAlertRuleTemplates();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <Modal title={Messages.alertRuleTemplate.addModal.title} isVisible={isVisible} onClose={() => setVisible(false)}>
      <Form
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting, form: { change } }) => (
          <form onSubmit={handleSubmit} data-testid="add-alert-rule-template-modal-form">
            <>
              <input type="file" accept=".yml, .yaml" ref={inputRef} onChange={onUploadFile(change)} hidden />
              <TextareaInputField
                name="yaml"
                label={Messages.alertRuleTemplate.addModal.fields.alertRuleTemplate}
                validators={[required]}
                className={styles.alertRuleTemplate}
              />
              <Button
                type="button"
                data-testid="alert-rule-template-upload-button"
                size="md"
                variant="secondary"
                className={styles.uploadAction}
                onClick={() => inputRef.current?.click()}
              >
                <Icon name="upload" />
                {Messages.alertRuleTemplate.addModal.upload}
              </Button>
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-testid="alert-rule-template-add-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  type="submit"
                  loading={submitting}
                >
                  {Messages.alertRuleTemplate.addModal.confirm}
                </LoaderButton>
                <Button
                  data-testid="alert-rule-template-cancel-button"
                  variant="secondary"
                  onClick={() => setVisible(false)}
                >
                  {Messages.alertRuleTemplate.addModal.cancel}
                </Button>
              </HorizontalGroup>
            </>
          </form>
        )}
      />
    </Modal>
  );
};
