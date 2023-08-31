import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, Text, Toggletip, useStyles2 } from '@grafana/ui';

interface NeedHelpInfoProps {
  contentText: string | JSX.Element;
  externalLink?: string;
  linkText?: string;
  title: string;
}
export function NeedHelpInfo({ contentText, externalLink, linkText, title }: NeedHelpInfoProps) {
  const styles = useStyles2(getStyles);
  return (
    <Toggletip
      content={<div className={styles.mutedText}>{contentText}</div>}
      title={
        <Stack gap={1} direction="row">
          <Icon name="question-circle" />
          {title}
        </Stack>
      }
      footer={
        externalLink ? (
          <a href={externalLink} target="_blank" rel="noreferrer">
            <Text color="link">
              {linkText} <Icon name="external-link-alt" />
            </Text>
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
  mutedText: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
  `,
  helpInfo: css`
    cursor: pointer;
    text-decoration: underline;
  `,
});
