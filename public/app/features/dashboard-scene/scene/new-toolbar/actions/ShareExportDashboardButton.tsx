import { ReactElement, useState } from 'react';

import { Button, ButtonGroup, Dropdown } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ToolbarActionProps } from '../types';

interface Props extends ToolbarActionProps {
  menu: ReactElement | (() => ReactElement);
  onMenuVisibilityChange?: (isOpen: boolean) => void;
  groupTestId: string;
  buttonLabel: string;
  buttonTooltip: string;
  buttonTestId: string;
  onButtonClick?: () => void;
  arrowLabel: string;
  arrowTestId: string;
  variant?: 'primary' | 'secondary';
}

export const ShareExportDashboardButton = ({
  dashboard,
  menu,
  onMenuVisibilityChange,
  groupTestId,
  buttonLabel,
  buttonTooltip,
  buttonTestId,
  onButtonClick,
  arrowLabel,
  arrowTestId,
  variant = 'secondary',
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ButtonGroup
      data-testid={groupTestId}
      onPointerDown={(evt) => {
        if (dashboard.state.isEditing && dashboard.state.isDirty) {
          evt.preventDefault();
          evt.stopPropagation();

          appEvents.publish(
            new ShowConfirmModalEvent({
              title: t('dashboard.toolbar.new.share-export.modal.title', 'Save changes to dashboard?'),
              text: t(
                'dashboard.toolbar.new.share-export.modal.text',
                'You have unsaved changes to this dashboard. You need to save them before you can share it.'
              ),
              icon: 'exclamation-triangle',
              noText: t('dashboard.toolbar.new.share-export.modal.noText', 'Discard'),
              yesText: t('dashboard.toolbar.new.share-export.modal.yesText', 'Save'),
              yesButtonVariant: 'primary',
              onConfirm: () => dashboard.openSaveDrawer({}),
            })
          );
        }
      }}
    >
      <Button data-testid={buttonTestId} size="sm" tooltip={buttonTooltip} variant={variant} onClick={onButtonClick}>
        {buttonLabel}
      </Button>
      <Dropdown
        overlay={menu}
        placement="bottom-end"
        onVisibleChange={(isOpen) => {
          if (dashboard.state.isEditing && dashboard.state.isDirty) {
            return;
          }

          onMenuVisibilityChange?.(isOpen);

          setIsOpen(isOpen);
        }}
      >
        <Button
          aria-label={arrowLabel}
          data-testid={arrowTestId}
          size="sm"
          icon={isOpen ? 'angle-up' : 'angle-down'}
          variant={variant}
        />
      </Dropdown>
    </ButtonGroup>
  );
};
