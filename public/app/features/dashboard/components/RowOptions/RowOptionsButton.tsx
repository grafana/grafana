import * as React from 'react';

import { Icon, ModalsController } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { OnRowOptionsUpdate } from './RowOptionsForm';
import { RowOptionsModal } from './RowOptionsModal';

export interface RowOptionsButtonProps {
  title: string;
  repeat?: string;
  onUpdate: OnRowOptionsUpdate;
  warning?: React.ReactNode;
}

export const RowOptionsButton = ({ repeat, title, onUpdate, warning }: RowOptionsButtonProps) => {
  const onUpdateChange = (hideModal: () => void) => (title: string, repeat?: string | null) => {
    onUpdate(title, repeat);
    hideModal();
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <button
            type="button"
            className="pointer"
            aria-label={t('dashboard.row-options-button.aria-label-row-options', 'Row options')}
            onClick={() => {
              showModal(RowOptionsModal, {
                title,
                repeat,
                onDismiss: hideModal,
                onUpdate: onUpdateChange(hideModal),
                warning,
              });
            }}
          >
            <Icon name="cog" />
          </button>
        );
      }}
    </ModalsController>
  );
};

RowOptionsButton.displayName = 'RowOptionsButton';
