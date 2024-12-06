import { useState } from 'react';

import { Button, Modal, Text, Space } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const MarkAsATemplateModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [isProcessingTemplates, setIsProcessingTemplates] = useState(false);

  const onMarkAsTemplate = async () => {
    try {
      await onConfirm();
      setIsProcessingTemplates(false);
      onDismiss();
    } catch { }
  };

  return (
    <Modal title="Mark as a Dashboard Template" onDismiss={onDismiss} {...props}>
      <Text element="p">
        This action will mark the following dashboards as templates. Templates can be used to create new dashboards with
        the same layout and panels.
      </Text>

      <DescendantCount selectedItems={selectedItems} />

      <Space v={3} />

      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary" fill="outline">
          <Trans i18nKey="browse-dashboards.action.cancel-button">Cancel</Trans>
        </Button>
        <Button onClick={onMarkAsTemplate} variant="primary">
          {isProcessingTemplates ? 'processing dashboard templates..' : 'Mark as a Dashboard Template'}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
