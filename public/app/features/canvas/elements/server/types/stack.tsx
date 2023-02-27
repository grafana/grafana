import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getServerStyles, ServerData } from '../server';

export const ServerStack = (data: ServerData) => {
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
          d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
        />
        <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
        <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
        <circle className={styles.circle} cx="189.99" cy="68.07" r="9.0052" />
      </g>
      <g transform="translate(0 55.18)">
        <path
          className={styles.server}
          x="54.86203"
          y="48.088943"
          width="159.1676"
          height="39.961231"
          d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
        />
        <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
        <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
        <circle className={styles.circle} cx="189.99" cy="68.07" r="9.0052" />
      </g>
      <g transform="translate(0 110)">
        <path
          className={styles.server}
          x="54.86203"
          y="48.088943"
          width="159.1676"
          height="39.961231"
          d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
        />
        <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
        <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
        <circle className={styles.circle} cx="189.99" cy="68.07" r="9.0052" />
      </g>
    </g>
  );
};
