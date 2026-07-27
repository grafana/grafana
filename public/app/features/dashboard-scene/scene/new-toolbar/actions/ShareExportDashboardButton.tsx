import { type ReactElement, useState } from 'react';

import { ButtonGroup, Dropdown, ToolbarButton } from '@grafana/ui';

import { type ToolbarActionProps } from '../types';

interface Props extends ToolbarActionProps {
  menu: ReactElement | (() => ReactElement);
  onMenuVisibilityChange?: (isOpen: boolean) => void;
  groupTestId: string;
  buttonTooltip: string;
  buttonTestId: string;
  onButtonClick?: () => void;
  arrowLabel: string;
  arrowTestId: string;
  loading?: boolean;
}

export const ShareExportDashboardButton = ({
  menu,
  onMenuVisibilityChange,
  groupTestId,
  buttonTooltip,
  buttonTestId,
  onButtonClick,
  arrowLabel,
  arrowTestId,
  loading,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ButtonGroup data-testid={groupTestId}>
      <ToolbarButton
        data-testid={buttonTestId}
        tooltip={buttonTooltip}
        variant="canvas"
        onClick={loading ? undefined : onButtonClick}
        icon={loading ? 'spinner' : 'share-alt'}
      />
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
          variant="canvas"
        />
      </Dropdown>
    </ButtonGroup>
  );
};
