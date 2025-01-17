import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

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
          <TextLink href={externalLink} external>
            {linkText}
          </TextLink>
        ) : undefined
      }
      closeButton={true}
      placement="bottom-start"
    >
      <div className={styles.helpInfo}>
        <Text variant="bodySmall" color="primary">
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Icon name="question-circle" size="sm" /> Need help?
          </Stack>
        </Text>
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
