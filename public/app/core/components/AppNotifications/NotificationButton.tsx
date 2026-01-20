import { type ReactElement } from 'react';

import { Button } from '@grafana/ui';

export interface NotificationButtonProps {
  buttonLabel: string;
  onClick: () => void;
  ariaLabel?: string;
}

export function NotificationButton({ buttonLabel, onClick, ariaLabel }: NotificationButtonProps) {
  return (
    <Button size="sm" variant="primary" fill="text" onClick={onClick} aria-label={ariaLabel ?? buttonLabel}>
      {buttonLabel}
    </Button>
  );
}

export function buildNotificationButton(props: NotificationButtonProps): ReactElement {
  return <NotificationButton {...props} />;
}
