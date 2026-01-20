import { type ReactElement } from 'react';

import { LinkButton } from '@grafana/ui';

export interface NotificationButtonProps {
  buttonLabel: string;
  href: string;
  ariaLabel?: string;
}

export function NotificationButton({ buttonLabel, href, ariaLabel }: NotificationButtonProps) {
  return (
    <LinkButton size="sm" variant="primary" fill="text" href={href} aria-label={ariaLabel ?? buttonLabel}>
      {buttonLabel}
    </LinkButton>
  );
}

export function buildNotificationButton(props: NotificationButtonProps): ReactElement {
  return <NotificationButton {...props} />;
}
