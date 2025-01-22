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
      content={
        <Text color="primary" variant="bodySmall">
          {contentText}
        </Text>
      }
      title={
        <Stack gap={0.5} direction="row" alignItems="center">
          <Icon name="question-circle" />
          <Text variant="body" color="primary" weight="medium">
            {title}
          </Text>
        </Stack>
      }
      footer={
        externalLink ? (
          <TextLink variant="bodySmall" href={externalLink} external>
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
  helpInfo: css({
    cursor: 'pointer',
    textDecoration: 'underline',
  }),
});
