import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';

import ActionButton from './ActionButton';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageActions: css`
      label: TracePageActions;
      display: flex;
      gap: 4px;
      margin-top: 2px;
    `,
    feedback: css`
      margin: 6px;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      &:hover {
        color: ${theme.colors.text.link};
      }
    `,
  };
};

export type TracePageActionsProps = {
  traceId: string;
};

export default function TracePageActions(props: TracePageActionsProps) {
  const { traceId } = props;
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

  return (
    <div className={styles.TracePageActions}>
      <a
        href="https://forms.gle/RZDEx8ScyZNguDoC8"
        className={styles.feedback}
        title="Share your thoughts about tracing in Grafana."
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" /> Give feedback
      </a>

      <ActionButton
        onClick={copyTraceId}
        ariaLabel={'Copy Trace ID'}
        label={copyTraceIdClicked ? 'Copied!' : 'Trace ID'}
        icon={'copy'}
      />
      {/* <ActionButton
        onClick={() => alert('not implemented')}
        ariaLabel={'Export Trace'}
        label={'Export'}
        icon={'save'}
      /> */}
    </div>
  );
}
