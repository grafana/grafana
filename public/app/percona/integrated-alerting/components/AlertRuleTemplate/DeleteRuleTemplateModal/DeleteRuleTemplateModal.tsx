import React, { FC, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { logger } from 'app/percona/shared/helpers/logger';

import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';

import { Messages } from './DeleteRuleTemplateModal.messages';
import { DeleteRuleTemplateModalProps } from './DeleteRuleTemplateModal.types';

const { title, getDeleteMessage, getDeleteSuccess } = Messages;

export const DeleteRuleTemplateModal: FC<React.PropsWithChildren<DeleteRuleTemplateModalProps>> = ({
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
