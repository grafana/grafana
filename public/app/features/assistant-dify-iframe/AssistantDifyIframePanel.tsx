import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, IconButton, Spinner, useStyles2, useTheme2 } from '@grafana/ui';

import { useAssistantDifyIframeContext } from './AssistantDifyIframeContext';
import { fetchDifyEmbedConfig, withEmbedTheme } from './difyIframeClient';

export const ASSISTANT_DIFY_IFRAME_SIDEBAR_WIDTH = 380;

export function AssistantDifyIframePanel() {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { isOpen, closeAssistant, iframeReloadKey, reloadIframe } = useAssistantDifyIframeContext();
  const [embedUrl, setEmbedUrl] = useState('');
  const [hasEmbedToken, setHasEmbedToken] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setIsLoadingConfig(true);
    setLoadError('');

    fetchDifyEmbedConfig()
      .then((config) => {
        if (cancelled) {
          return;
        }
        setHasEmbedToken(config.hasEmbedToken);
        setEmbedUrl(config.embedUrl || '');
        if (!config.hasEmbedToken || !config.embedUrl) {
          setLoadError(
            t(
              'assistant-dify-iframe.errors.missing-token',
              'DIFY_EMBED_TOKEN is not set. In Dify: Publish → Embed → copy the token into `.dify.env`, then restart the proxy.'
            )
          );
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setLoadError(
          t(
            'assistant-dify-iframe.errors.unreachable',
            'Could not load Dify embed config.\n\n{{error}}\n\nMake sure the proxy is running (`node scripts/assistant-dify-proxy.mjs`).',
            { error: err instanceof Error ? err.message : String(err) }
          )
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, iframeReloadKey]);

  const themedEmbedUrl = useMemo(() => {
    if (!embedUrl) {
      return '';
    }
    return withEmbedTheme(embedUrl, theme);
  }, [embedUrl, theme]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.panel}
      role="complementary"
      aria-label={t('assistant-dify-iframe.panel.aria-label', 'Grafana Assistant (Dify iframe)')}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Icon name="ai-sparkle" size="lg" className={styles.headerIcon} />
          <span className={styles.headerTitle}>
            <Trans i18nKey="assistant-dify-iframe.header.title">Grafana Assistant</Trans>
          </span>
          <span className={styles.badge}>
            <Trans i18nKey="assistant-dify-iframe.header.badge">Dify</Trans>
          </span>
          <span className={styles.badgeSecondary}>
            <Trans i18nKey="assistant-dify-iframe.header.badge-embed">Embed</Trans>
          </span>
        </div>
        <div className={styles.headerActions}>
          <IconButton
            name="sync"
            size="md"
            tooltip={t('assistant-dify-iframe.actions.reload', 'New conversation')}
            onClick={reloadIframe}
            aria-label={t('assistant-dify-iframe.actions.reload', 'New conversation')}
            disabled={!hasEmbedToken}
          />
          <IconButton
            name="times"
            size="lg"
            tooltip={t('assistant-dify-iframe.actions.close', 'Close assistant')}
            onClick={closeAssistant}
            aria-label={t('assistant-dify-iframe.actions.close', 'Close assistant')}
          />
        </div>
      </div>

      <div className={styles.iframeShell}>
        {isLoadingConfig && (
          <div className={styles.centered}>
            <Spinner size="lg" />
          </div>
        )}

        {!isLoadingConfig && loadError && (
          <div className={styles.errorBox}>
            {loadError.split('\n').map((line, i) => (
              <p key={i} className={styles.errorLine}>
                {line}
              </p>
            ))}
          </div>
        )}

        {!isLoadingConfig && !loadError && themedEmbedUrl && (
          <iframe
            key={`${iframeReloadKey}-${theme.isDark ? 'dark' : 'light'}`}
            className={styles.iframe}
            src={themedEmbedUrl}
            title={t('assistant-dify-iframe.iframe.title', 'Dify chatbot')}
            allow="microphone; clipboard-read; clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: ASSISTANT_DIFY_IFRAME_SIDEBAR_WIDTH,
    backgroundColor: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.primary,
    minHeight: 48,
    flexShrink: 0,
  }),
  headerLeft: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
  }),
  headerIcon: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  headerTitle: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
  }),
  badge: css({
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.primary.contrastText,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.shape.radius.pill,
    padding: theme.spacing(0.25, 0.75),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 0,
  }),
  badgeSecondary: css({
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.pill,
    padding: theme.spacing(0.25, 0.75),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 0,
  }),
  headerActions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flexShrink: 0,
  }),
  iframeShell: css({
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: theme.colors.background.secondary,
  }),
  iframe: css({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: theme.colors.background.primary,
  }),
  centered: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  errorBox: css({
    padding: theme.spacing(2),
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
  }),
  errorLine: css({
    margin: theme.spacing(0, 0, 0.5, 0),
  }),
});
