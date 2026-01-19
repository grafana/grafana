import { ReactElement, useState } from 'react';

import { ButtonGroup, Dropdown, ToolbarButton } from '@grafana/ui';

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
  variant?: 'primary' | 'canvas';
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
  variant = 'canvas',
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ButtonGroup data-testid={groupTestId}>
      <ToolbarButton
        data-testid={buttonTestId}
        tooltip={buttonTooltip}
        variant={variant}
        onClick={onButtonClick}
        icon="share-alt"
      >
        {buttonLabel}
      </ToolbarButton>
      <Dropdown
        overlay={menu}
        placement="bottom-end"
        onVisibleChange={(isOpen) => {
          onMenuVisibilityChange?.(isOpen);

          setIsOpen(isOpen);
        }}
      >
        <ToolbarButton
          aria-label={arrowLabel}
          data-testid={arrowTestId}
          icon={isOpen ? 'angle-up' : 'angle-down'}
          variant={variant}
        />
      </Dropdown>
    </ButtonGroup>
  );
};
