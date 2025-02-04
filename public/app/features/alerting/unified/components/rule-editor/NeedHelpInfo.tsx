import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, Text, Toggletip, useStyles2 } from '@grafana/ui';

interface NeedHelpInfoProps {
  contentText: string | JSX.Element;
  externalLink?: string;
  linkText?: string;
  title?: string;
}
export function NeedHelpInfo({ contentText, externalLink, linkText, title = 'Need help?' }: NeedHelpInfoProps) {
  const styles = useStyles2(getStyles);

  return (
    <Toggletip
      content={<div className={styles.mutedText}>{contentText}</div>}
      title={
        <Stack gap={0.5} direction="row" alignItems="center">
          <Icon name="question-circle" />
          {title}
        </Stack>
      }
      footer={
        externalLink ? (
          <a href={externalLink} target="_blank" rel="noreferrer">
            <Stack direction="row" gap={0.5} alignItems="center">
              <Text color="link">
                {linkText} <Icon size="sm" name="external-link-alt" />
              </Text>
            </Stack>
          </a>
        ) : undefined
      }
      closeButton={true}
      placement="bottom-start"
    >
      <div className={styles.helpInfo}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="question-circle" size="sm" />
          <Text variant="bodySmall" color="primary">
            Need help?
          </Text>
        </Stack>
      </div>
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mutedText: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
  }),
  helpInfo: css({
    cursor: 'pointer',
    textDecoration: 'underline',
  }),
});
