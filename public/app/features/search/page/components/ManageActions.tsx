import React from 'react';

import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import { getStyles } from './ActionRow';

type Props = {
  items: Map<string, Set<string>>;
};

export function ManageActions({ items }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          {[...items.keys()].map((k) => {
            const vals = items.get(k);
            return (
              <div key={k}>
                {k} ({vals?.size})
              </div>
            );
          })}
        </HorizontalGroup>
      </div>
    </div>
  );
}
