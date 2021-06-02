import React, { FC, useState } from 'react';
import { logger } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { DeleteRuleTemplateModalProps } from './DeleteRuleTemplateModal.types';
import { Messages } from './DeleteRuleTemplateModal.messages';
import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';

const { title, getDeleteMessage, getDeleteSuccess } = Messages;

export const DeleteRuleTemplateModal: FC<DeleteRuleTemplateModalProps> = ({
  template,
  isVisible,
  setVisible,
  getAlertRuleTemplates,
}) => {
  const [pending, setPending] = useState(false);
  const { name, summary } = template || {};
  const onDelete = async () => {
    try {
      setPending(true);
      await AlertRuleTemplateService.delete({ name });
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [getDeleteSuccess(summary)]);
      getAlertRuleTemplates();
    } catch (e) {
      logger.error(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <DeleteModal
      title={title}
      message={getDeleteMessage(summary)}
      loading={pending}
      isVisible={isVisible}
      setVisible={setVisible}
      onDelete={onDelete}
    />
  );
};
