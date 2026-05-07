import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Alert, type AlertVariant, Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';

export interface StepResultAlertProps {
  severity: AlertVariant;
  description: string;
  help?: string;
  link?: ResultCardLink;
}

interface ResultCardLink {
  href: string;
  text: string;
}

/**
 * Alert that just shows the message and optional link. Link should point to some resource that the step successfully
 * created.
 */
export function StepResultAlert({ severity, description, link, help }: StepResultAlertProps) {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity={severity} title="" aria-label={description}>
      <Stack direction="row" justifyContent={'space-between'}>
        <Text>{description}</Text>
        {link && (
          <Link href={link.href} className={styles.link}>
            {link.text}
            <Icon name="external-link-alt" size="md" aria-hidden={true} className={styles.linkIcon} />
          </Link>
        )}
      </Stack>
      {help && <Text variant={'bodySmall'}>{help}</Text>}
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  link: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  linkIcon: css({
    flexShrink: 0,
  }),
});
