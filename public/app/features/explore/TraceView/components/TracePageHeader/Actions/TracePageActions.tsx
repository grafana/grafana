import { css } from '@emotion/css';
import { useState } from 'react';

import { createContext, ItemDataType, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2, CoreApp, DataFrame } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useTheme2 } from '@grafana/ui';


import { config } from '../../../../../../core/config';
import { downloadTraceAsJson } from '../../../../../inspector/utils/download';

import ActionButton from './ActionButton';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageActions: css({
      label: 'TracePageActions',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      marginBottom: '10px',
    }),
    feedbackContainer: css({
      color: theme.colors.text.link,
    }),
    feedback: css({
      margin: '6px',
      color: theme.colors.text.link,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};

export type TracePageActionsProps = {
  traceId: string;
  data: DataFrame;
  app?: CoreApp;
  datasourceName?: string;
  datasourceUid?: string;
  datasourceType?: string;
};

export default function TracePageActions(props: TracePageActionsProps) {
  const { traceId, data, app, datasourceName, datasourceUid, datasourceType } = props;
  const theme = useTheme2();

  const styles = getStyles(theme);
  const [copyTraceIdClicked, setCopyTraceIdClicked] = useState(false);

  const copyTraceId = () => {
    navigator.clipboard.writeText(traceId);
    setCopyTraceIdClicked(true);
    setTimeout(() => {
      setCopyTraceIdClicked(false);
    }, 5000);
  };

  const exportTrace = () => {
    const traceFormat = downloadTraceAsJson(data, 'Trace-' + traceId.substring(traceId.length - 6));
    reportInteraction('grafana_traces_download_traces_clicked', {
      app,
      grafana_version: config.buildInfo.version,
      trace_format: traceFormat,
      location: 'trace-view',
    });
  };

  function AssistantButton() {
    const [isAvailable, openAssistant] = useAssistant();

    if (!isAvailable) {
      return null;
    }

    return (
      <button onClick={() => openAssistant?.({ 
        prompt: `Help me summarize this trace view`,
        context: [
          createContext(ItemDataType.Datasource, {
            datasourceName: datasourceName || 'unknown',
            datasourceUid: datasourceUid || 'unknown',
            datasourceType: datasourceType || 'unknown',
          }),
          createContext(ItemDataType.Structured, {
            title: t('explore.trace-page-actions.trace-view-query', 'Trace View Query'),
            data: {
              query: traceId,
            },
          }),
        ],
      })}>
        <Trans i18nKey="explore.trace-page-actions.open-assistant">Open Assistant</Trans>
      </button>
    );
  }

  return (
    <div className={styles.TracePageActions}>
      <AssistantButton />
      {config.feedbackLinksEnabled && (
        <div className={styles.feedbackContainer}>
          <Icon name="comment-alt-message" />
          <a
            href="https://forms.gle/RZDEx8ScyZNguDoC8"
            className={styles.feedback}
            title={t(
              'explore.trace-page-actions.title-share-thoughts-about-tracing-grafana',
              'Share your thoughts about tracing in Grafana.'
            )}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Trans i18nKey="explore.trace-page-actions.give-feedback">Give feedback</Trans>
          </a>
        </div>
      )}

      <ActionButton
        onClick={copyTraceId}
        ariaLabel={t('explore.trace-page-actions.ariaLabel-copy-trace-id', 'Copy Trace ID')}
        label={
          copyTraceIdClicked
            ? t('explore.trace-page-actions.label-copied', 'Copied!')
            : t('explore.trace-page-actions.label-trace-id', 'Trace ID')
        }
        icon={'copy'}
      />
      <ActionButton
        onClick={exportTrace}
        ariaLabel={t('explore.trace-page-actions.ariaLabel-export-trace', 'Export Trace')}
        label={t('explore.trace-page-actions.label-export', 'Export')}
        icon={'save'}
      />
    </div>
  );
}
