import { css } from '@emotion/css';
import React, { useState } from 'react';

import { useStyles2 } from '@grafana/ui';

import ActionButton from './ActionButton';

export const getStyles = () => {
  return {
    TracePageActions: css`
      label: TracePageActions;
      display: flex;
      gap: 4px;
    `,
  };
};

export type TracePageActionsProps = {
  traceId: string;
};

export default function TracePageActions(props: TracePageActionsProps) {
  const { traceId } = props;
  const styles = useStyles2(getStyles);
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
