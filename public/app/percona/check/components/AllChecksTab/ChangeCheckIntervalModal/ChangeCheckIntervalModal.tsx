import React, { FC } from 'react';
import { withTypes } from 'react-final-form';
import { logger, RadioButtonGroupField, LoaderButton, Modal } from '@percona/platform-core';
import { Messages } from './ChangeCheckIntervalModal.messages';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { CheckService } from 'app/percona/check/Check.service';
import { getStyles } from './ChangeCheckIntervalModal.styles';
import { ChangeCheckIntervalModalProps, ChangeCheckIntervalFormValues } from './types';
import { checkIntervalOptions } from './ChangeCheckIntervalModal.constants';

const { Form } = withTypes<ChangeCheckIntervalFormValues>();

export const ChangeCheckIntervalModal: FC<ChangeCheckIntervalModalProps> = ({ check, onClose, onIntervalChanged }) => {
  const styles = useStyles(getStyles);
  const { summary, name, interval } = check;

  const changeInterval = async ({ interval }: ChangeCheckIntervalFormValues) => {
    try {
      await CheckService.changeCheck({
        params: [
          {
            name: name,
            interval,
          },
        ],
      });
      appEvents.emit(AppEvents.alertSuccess, [Messages.getSuccess(summary)]);
      onIntervalChanged({ ...check, interval: interval! });
    } catch (e) {
      logger.error(e);
    }
  };

  const initialValues: ChangeCheckIntervalFormValues = {
    interval,
  };

  return (
    <Modal data-testid="change-check-interval-modal" title={Messages.title} isVisible onClose={onClose}>
      <div className={styles.content}>
        <h4 className={styles.title}>{Messages.getDescription(summary)}</h4>
        <Form
          onSubmit={changeInterval}
          initialValues={initialValues}
          render={({ handleSubmit, submitting, pristine }) => (
            <form data-testid="change-check-interval-form" onSubmit={handleSubmit}>
              <div data-testid="change-check-interval-radio-group-wrapper" className={styles.intervalRadioWrapper}>
                <RadioButtonGroupField name="interval" options={checkIntervalOptions} />
              </div>
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  disabled={submitting || pristine}
                  loading={submitting}
                  variant="destructive"
                  size="md"
                  data-testid="change-check-interval-modal-save"
                >
                  {Messages.save}
                </LoaderButton>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  data-testid="change-check-interval-modal-cancel"
                >
                  {Messages.cancel}
                </Button>
              </HorizontalGroup>
            </form>
          )}
        />
      </div>
    </Modal>
  );
};
