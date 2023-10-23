import { css } from '@emotion/css';
import React from 'react';

import { TextArea, useStyles2 } from '@grafana/ui';

export const StackTraces = ({ stackTraces }: { stackTraces: string[] }) => {
  const styles = useStyles2(getStyles);
  let text;

  if (stackTraces?.length > 1) {
    text = stackTraces.map((stackTrace, index) => `StackTrace ${index + 1}:\n${stackTrace}`).join('\n');
  } else {
    text = stackTraces?.[0];
  }

  return (
    <TextArea className={styles.stackTraces} style={{ cursor: 'unset' }} readOnly cols={10} rows={10} value={text} />
  );
};

const getStyles = () => ({
  stackTraces: css({
    wordBreak: 'break-all',
    whiteSpace: 'pre',
  }),
});
