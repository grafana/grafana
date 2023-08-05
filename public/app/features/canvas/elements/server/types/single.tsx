import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getServerStyles, ServerData } from '../server';

export const ServerSingle = (data: ServerData) => {
  const styles = useStyles2(getServerStyles(data));
  return (
    <g>
      <g className={styles.outline} transform="matrix(1.01 0 0 1.01 -.375 -.375)">
        <g className={styles.server}>
          <path d="m3.2812 55.659 9.125-52.377h50.188l9.125 52.377" />
          <path d="m3.2812 56.328c0-2.5246 2.0379-4.5625 4.5625-4.5625h59.313c2.5245 0 4.5625 2.0379 4.5625 4.5625v10.828c0 2.5245-2.038 4.5625-4.5625 4.5625h-59.313c-2.5246 0-4.5625-2.038-4.5625-4.5625z" />
        </g>
        <path d="m12.406 61.742h30.69" />
        <path d="m52.8 51.765v19.953" />
        <path
          className={styles.circleBack}
          transform="matrix(2.7592 0 0 2.7592 -109.42 -108.61)"
          d="m62.198 60.586c.6388 0 1.1558.5171 1.1558 1.1559 0 .6387-.517 1.1558-1.1558 1.1558-.6387 0-1.1558-.5171-1.1558-1.1558 0-.6388.5171-1.1559 1.1558-1.1559z"
        />
        <path
          className={styles.circle}
          transform="matrix(1.4775 0 0 1.4775 -29.697 -29.479)"
          d="m62.198 60.586c.6388 0 1.1558.5171 1.1558 1.1559 0 .6387-.517 1.1558-1.1558 1.1558-.6387 0-1.1558-.5171-1.1558-1.1558 0-.6388.5171-1.1559 1.1558-1.1559z"
        />
      </g>
    </g>
  );
};
