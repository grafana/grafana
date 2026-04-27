import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { ModalsController } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

import { type OnRowOptionsUpdate } from './RowOptionsForm';
import { RowOptionsModal } from './RowOptionsModal';

export interface RowOptionsButtonProps {
  title: string;
  repeat?: string;
  parent: SceneObject;
  onUpdate: OnRowOptionsUpdate;
  isUsingDashboardDS: boolean;
}

export const RowOptionsButton = ({ repeat, title, parent, onUpdate, isUsingDashboardDS }: RowOptionsButtonProps) => {
  return (
    <ModalsController>
      {({ showModal, hideModal }) => {
        return (
          <button
            type="button"
            className="pointer"
            aria-label={t('dashboard.default-layout.row-options.button.label', 'Row options')}
            onClick={() => {
              showModal(RowOptionsModal, {
                title,
                repeat,
                parent,
                onDismiss: hideModal,
                onUpdate: (title: string, repeat?: string | null) => {
                  onUpdate(title, repeat);
                  hideModal();
                },
                isUsingDashboardDS,
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
