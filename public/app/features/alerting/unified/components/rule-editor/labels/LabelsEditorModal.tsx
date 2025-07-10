import { t } from '@grafana/i18n';
import { Modal } from '@grafana/ui';

import { KBObjectArray } from '../../../types/rule-form';

import { LabelsSubForm } from './LabelsField';

export interface LabelsEditorModalProps {
  isOpen: boolean;
  initialLabels: Array<{
    key: string;
    value: string;
  }>;
  onClose: (labelsToUodate?: KBObjectArray) => void;
  dataSourceName: string;
}
export function LabelsEditorModal({ isOpen, onClose, dataSourceName, initialLabels }: LabelsEditorModalProps) {
  return (
    <Modal
      title={t('alerting.labels-editor-modal.title-edit-labels', 'Edit labels')}
      closeOnEscape
      isOpen={isOpen}
      onDismiss={() => onClose()}
    >
      <LabelsSubForm dataSourceName={dataSourceName} onClose={onClose} initialLabels={initialLabels} />
    </Modal>
  );
}
