import React from 'react';

import { LogsSortOrder } from '@grafana/schema';
import { InlineField, RadioButtonGroup } from '@grafana/ui';

interface Props {
  logsSortOrder: LogsSortOrder;
  onChangeLogsSortOrder(): void;
  isFlipping: boolean;
  styles: Record<string, string>;
}

export const LogsOrder = ({ logsSortOrder, onChangeLogsSortOrder, isFlipping, styles }: Props) => {
  return (
    <div>
      <InlineField className={styles.logOptionMenuItem}>
        <RadioButtonGroup
          disabled={isFlipping}
          options={[
            {
              label: '↑',
              value: LogsSortOrder.Descending,
              description: 'Show results newest to oldest',
            },
            {
              label: '↓',
              value: LogsSortOrder.Ascending,
              description: 'Show results oldest to newest',
            },
          ]}
          value={logsSortOrder}
          onChange={onChangeLogsSortOrder}
          className={styles.radioButtons}
        />
      </InlineField>
    </div>
  );
};
