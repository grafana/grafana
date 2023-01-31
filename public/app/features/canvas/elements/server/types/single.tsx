import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getServerStyles, ServerData } from '../server';

export const ServerSingle = (data: ServerData) => {
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
          d="m56.979 48.089h154.93c1.169 0 2.1167.94768 2.1167 2.1167v145.73c0 1.169-.94768 2.1167-2.1167 2.1167h-154.93c-1.169 0-2.1167-.94768-2.1167-2.1167v-145.73c0-1.169.94768-2.1167 2.1167-2.1167z"
        />
        <circle className={styles.circle} cx="189.99" cy="68.07" r="9.0052" />
        <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
        <rect x="55.558" y="86.141" width="107.76" height="5.7472" />
        <rect transform="translate(31.804,24.362)" x="23.779" y="90.421" width="107.76" height="5.7472" />
        <g className={styles.thinLine}>
          <rect x="63.549" y="73.261" width="107.76" height="2.8736" />
          <rect x="63.574" y="101.9" width="107.76" height="2.8736" />
          <rect x="63.598" y="130.54" width="107.76" height="2.8736" />
        </g>
      </g>
    </g>
  );
};
