import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, CoreApp, DataFrame } from '@grafana/data';
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
};

export default function TracePageActions(props: TracePageActionsProps) {
  const { traceId, data, app } = props;
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

  return (
    <div className={styles.TracePageActions}>
      <div className={styles.feedbackContainer}>
        <Icon name="comment-alt-message" />
        <a
          href="https://forms.gle/RZDEx8ScyZNguDoC8"
          className={styles.feedback}
          title="Share your thoughts about tracing in Grafana."
          target="_blank"
          rel="noreferrer noopener"
        >
          Give feedback
        </a>
      </div>

      <ActionButton
        onClick={copyTraceId}
        ariaLabel={'Copy Trace ID'}
        label={copyTraceIdClicked ? 'Copied!' : 'Trace ID'}
        icon={'copy'}
      />
      <ActionButton onClick={exportTrace} ariaLabel={'Export Trace'} label={'Export'} icon={'save'} />
    </div>
  );
}
