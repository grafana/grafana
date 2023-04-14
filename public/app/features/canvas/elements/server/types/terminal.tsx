import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getServerStyles, ServerData } from '../server';

export const ServerTerminal = (data: ServerData) => {
  const styles = useStyles2(getServerStyles(data));
  return (
    <g className={styles.outline}>
      <g className={styles.server}>
        <path d="m5.3125 9.6562c0-3.5621 2.8754-6.4375 6.4375-6.4375h51.5c3.5621 0 6.4375 2.8754 6.4375 6.4375v28.625c0 3.5621-2.8754 6.4375-6.4375 6.4375h-51.5c-3.5621 0-6.4375-2.8754-6.4375-6.4375z" />
        <path d="m2.8125 59.859c0-2.5592 2.0658-4.625 4.625-4.625h60.125c2.5592 0 4.625 2.0658 4.625 4.625v7.8933c0 2.5592-2.0658 4.625-4.625 4.625h-60.125c-2.5592 0-4.625-2.0658-4.625-4.625z" />
      </g>
      <path d="m37.5 46.719v2.875" />
      <path d="m24.625 51.343h25.75" />
      <path d="m12.062 63.804h31.111" />
      <path d="m53.008 55.234v17.143" />
      <path
        className={styles.circleBack}
        transform="matrix(2.7868 0 0 2.7868 -110.81 -108.2)"
        d="m62.198 60.586c.6388 0 1.1558.5171 1.1558 1.1559 0 .6387-.517 1.1558-1.1558 1.1558-.6387 0-1.1558-.5171-1.1558-1.1558 0-.6388.5171-1.1559 1.1558-1.1559z"
      />
      <path
        className={styles.circle}
        transform="matrix(1.4922 0 0 1.4922 -30.294 -28.27)"
        d="m62.198 60.586c.6388 0 1.1558.5171 1.1558 1.1559 0 .6387-.517 1.1558-1.1558 1.1558-.6387 0-1.1558-.5171-1.1558-1.1558 0-.6388.5171-1.1559 1.1558-1.1559z"
      />
    </g>
  );
};
