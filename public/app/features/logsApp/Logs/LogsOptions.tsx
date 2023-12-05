import { capitalize } from "lodash";
import React from "react";

import { LogsDedupDescription } from "@grafana/data";
import { LogsDedupStrategy, LogsSortOrder } from "@grafana/schema";
import { Button, Dropdown, Icon, InlineField, InlineFieldRow, InlineSwitch, RadioButtonGroup } from "@grafana/ui";

// we need to define the order of these explicitly
const DEDUP_OPTIONS = [
  LogsDedupStrategy.none,
  LogsDedupStrategy.exact,
  LogsDedupStrategy.numbers,
  LogsDedupStrategy.signature,
];

/**
 * Placeholder component for Log Details to clean up the UI and prepare for that.
 */
interface Props {
  styles: Record<string, string>;
  showTime: boolean;
  showLabels: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  isFlipping: boolean;
  dedupStrategy: LogsDedupStrategy;
  exploreId: string;
  logsSortOrder: LogsSortOrder;
  onChangeTime(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangeLabels(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangeWrapLogMessage(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangePrettifyLogMessage(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangeDedup(dedupStrategy: LogsDedupStrategy): void;
  onChangeLogsSortOrder(): void;
}

export const LogsOptions = ({
  styles,
  showTime,
  onChangeTime,
  exploreId,
  showLabels,
  onChangeLabels,
  wrapLogMessage,
  onChangeWrapLogMessage,
  onChangePrettifyLogMessage,
  prettifyLogMessage,
  dedupStrategy,
  onChangeDedup,
  isFlipping,
  logsSortOrder,
  onChangeLogsSortOrder
}: Props) => {
  const menu = (
    <div className={styles.logOptionsMenu}>
      <InlineField label="Time" className={styles.logOptionMenuItem}>
        <InlineSwitch
          value={showTime}
          onChange={onChangeTime}
          transparent
          id={`show-time_${exploreId}`}
        />
      </InlineField>
      <InlineField label="Unique labels" className={styles.logOptionMenuItem}>
        <InlineSwitch
          value={showLabels}
          onChange={onChangeLabels}
          transparent
          id={`unique-labels_${exploreId}`}
        />
      </InlineField>
      <InlineField label="Wrap lines" className={styles.logOptionMenuItem}>
        <InlineSwitch
          value={wrapLogMessage}
          onChange={onChangeWrapLogMessage}
          transparent
          id={`wrap-lines_${exploreId}`}
        />
      </InlineField>
      <InlineField label="Prettify JSON" className={styles.logOptionMenuItem}>
        <InlineSwitch
          value={prettifyLogMessage}
          onChange={onChangePrettifyLogMessage}
          transparent
          id={`prettify_${exploreId}`}
        />
      </InlineField>
    </div>
  );
  return (
    <Dropdown overlay={menu}>
    <Button
      size="md"
      variant="secondary"
    >
      <Icon name="sliders-v-alt" size="md" />
      Logs settings
    </Button>
  </Dropdown>
  );
};
