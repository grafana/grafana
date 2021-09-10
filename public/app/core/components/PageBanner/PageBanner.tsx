import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon, IconButton, IconName, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2, PageBannerDisplayEvent, PageBannerEventPayload, PageBannerSeverity } from '@grafana/data';
import { appEvents } from 'app/core/core';

export function PageBanner(): React.ReactElement | null {
  const [banner, setBanner] = useState<PageBannerEventPayload | undefined>();
  const severityStyling = useStylingBySeverity(banner?.severity);
  const styles = useStyles2((theme) => getStyles(theme, severityStyling));
  const onClose = useCallback(() => setBanner(undefined), []);

  useEffect(() => {
    const subscription = appEvents.subscribe(PageBannerDisplayEvent, (event) => {
      setBanner(event.payload);
    });
    return subscription.unsubscribe;
  }, []);

  if (!banner) {
    return null;
  }

  const { text, trailingAction } = banner;

  return (
    <div className={styles.banner}>
      <div className={styles.icon}>
        <Icon size="xl" name={severityStyling.icon} />
      </div>
      <div className={styles.content}>
        <div>{text}</div>
        {trailingAction && (
          <div className={styles.action}>
            <LinkButton
              fill="outline"
              size="sm"
              href={trailingAction.href}
              target="__blank"
              className={styles.actionLink}
            >
              {trailingAction.text}
            </LinkButton>
          </div>
        )}
      </div>
      <div className={styles.icon}>
        <IconButton size="xl" name="times" onClick={onClose} className={styles.close} />
      </div>
    </div>
  );
}

type SeverityStyling = {
  text: string;
  background: string;
  icon: IconName;
};

function useStylingBySeverity(severity: PageBannerSeverity | undefined): SeverityStyling {
  const theme = useTheme2();
  return useMemo(() => {
    switch (severity) {
      case PageBannerSeverity.error:
        return {
          icon: 'exclamation-triangle',
          background: theme.colors.error.main,
          text: theme.colors.error.contrastText,
        };

      case PageBannerSeverity.warning:
        return {
          icon: 'exclamation-triangle',
          background: theme.colors.warning.main,
          text: theme.colors.warning.contrastText,
        };

      case PageBannerSeverity.info:
      default:
        return {
          icon: 'info-circle',
          background: theme.colors.info.main,
          text: theme.colors.info.contrastText,
        };
    }
  }, [theme, severity]);
}

function getStyles(theme: GrafanaTheme2, severityStyling: SeverityStyling) {
  return {
    banner: css`
      flex-grow: 1;
      display: flex;
      align-items: center;
      margin: ${theme.spacing(2, 1.5, 0)};
      background-color: ${severityStyling.background};
      border-radius: 2px;
      height: 64px;
    `,
    icon: css`
      padding: ${theme.spacing(0, 3)};
      color: ${severityStyling.text};
    `,
    content: css`
      flex-grow: 1;
      display: flex;
      align-items: center;
      color: ${severityStyling.text};
    `,
    action: css`
      margin: ${theme.spacing(0, 0, 0, 1)};
    `,
    actionLink: css`
      color: ${severityStyling.text};
      border: 1px solid ${severityStyling.text};
      padding: ${theme.spacing(1)};
      font-weight: 400;
    `,
    close: css`
      color: ${severityStyling.text};
    `,
  };
}
