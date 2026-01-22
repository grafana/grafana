import { type ReactElement } from 'react';

import { LinkButton, Stack } from '@grafana/ui';

export interface NotificationButtonProps {
  title: string;
  buttonLabel: string;
  href: string;
  ariaLabel?: string;
}

export function NotificationButton({ title, buttonLabel, href, ariaLabel }: NotificationButtonProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
      {title}
      <LinkButton variant="secondary" size="sm" fill="solid" href={href} aria-label={ariaLabel ?? buttonLabel}>
        {buttonLabel}
      </LinkButton>
    </Stack>
  );
}

export function buildNotificationButton(props: NotificationButtonProps): ReactElement {
  return <NotificationButton {...props} />;
}
