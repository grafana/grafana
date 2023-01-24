import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getServerStyles, ServerData } from '../server';

export const ServerTerminal = (data: ServerData) => {
  const styles = useStyles2(getServerStyles(data));
  return (
    <g transform="translate(-31.804 -24.362)">
      <g>
        <path
          className={styles.server}
          x="54.86203"
          y="48.088943"
          width="159.1676"
          height="39.961231"
          d="m56.979 48.089h54.93c1.169 0 2.1167.94768 2.1167 2.1167v145.73c0 1.169-.94768 2.1167-2.1167 2.1167h-54.93c-1.169 0-2.1167-.94768-2.1167-2.1167v-145.73c0-1.169.94768-2.1167 2.1167-2.1167z"
        />
        <g transform="matrix(.50833 0 0 1 27.315 0)">
          <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
          <rect x="55.558" y="86.141" width="107.76" height="5.7472" />
          <g className={styles.thinLine}>
            <rect x="74.357" y="73.261" width="96.957" height="2.8736" />
            <rect x="74.379" y="101.9" width="96.957" height="2.8736" />
          </g>
        </g>
        <circle className={styles.circle} cx="83.858" cy="178.2" r="5.9401" />
      </g>
      <g transform="translate(-1.9978 -7.5028)">
        <path className={styles.monitor} d="m103.22 75.305h118.87v76.914h-118.87z" />
        <path
          className={styles.monitorOutline}
          d="m103.22 70.305-5 5v76.916l5 5h118.87l5-5v-76.916l-5-5zm5 10h108.87v58.916h-108.87z"
        />
      </g>
      <path d="m135.6 148.14h50.113l4 15.156h-58.113z" />
      <path className={styles.keyboard} d="m118.23 183.19h88.848l24 19.476h-136.85z" />
    </g>
  );
};
