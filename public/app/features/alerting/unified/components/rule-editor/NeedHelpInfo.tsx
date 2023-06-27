import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, Toggletip, useStyles2 } from '@grafana/ui';

interface NeedHelpInfoProps {
  contentText: string;
  externalLink: string;
  linkText: string;
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
        <a href={externalLink} target="_blank" rel="noreferrer">
          <div className={styles.infoLink}>
            {linkText} <Icon name="external-link-alt" />
          </div>
        </a>
      }
      closeButton={true}
      placement="bottom-start"
    >
      <div className={styles.helpInfo}>
        <Icon name="question-circle" />
        <div className={styles.helpInfoText}>Need help?</div>
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
    display: flex;
    flex-direction: row;
    align-items: center;
    width: fit-content;
    font-weight: ${theme.typography.fontWeightMedium};
    margin-left: ${theme.spacing(1)};
    font-size: ${theme.typography.size.sm};
    cursor: pointer;
    color: ${theme.colors.text.primary};
  `,
  helpInfoText: css`
    margin-left: ${theme.spacing(0.5)};
    text-decoration: underline;
  `,
  infoLink: css`
    color: ${theme.colors.text.link};
  `,
});
