import React from "react";

import { LogsDedupStrategy, LogsSortOrder } from "@grafana/schema";
import { InlineField, InlineFieldRow, InlineSwitch, RadioButtonGroup } from "@grafana/ui";
import { capitalize } from "lodash";
import { LogsDedupDescription } from "@grafana/data";

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
  return (
    <div className={styles.logOptions}>
      <InlineFieldRow>
        <InlineField label="Time" className={styles.horizontalInlineLabel} transparent>
          <InlineSwitch
            value={showTime}
            onChange={onChangeTime}
            className={styles.horizontalInlineSwitch}
            transparent
            id={`show-time_${exploreId}`}
          />
        </InlineField>
        <InlineField label="Unique labels" className={styles.horizontalInlineLabel} transparent>
          <InlineSwitch
            value={showLabels}
            onChange={onChangeLabels}
            className={styles.horizontalInlineSwitch}
            transparent
            id={`unique-labels_${exploreId}`}
          />
        </InlineField>
        <InlineField label="Wrap lines" className={styles.horizontalInlineLabel} transparent>
          <InlineSwitch
            value={wrapLogMessage}
            onChange={onChangeWrapLogMessage}
            className={styles.horizontalInlineSwitch}
            transparent
            id={`wrap-lines_${exploreId}`}
          />
        </InlineField>
        <InlineField label="Prettify JSON" className={styles.horizontalInlineLabel} transparent>
          <InlineSwitch
            value={prettifyLogMessage}
            onChange={onChangePrettifyLogMessage}
            className={styles.horizontalInlineSwitch}
            transparent
            id={`prettify_${exploreId}`}
          />
        </InlineField>
        <InlineField label="Deduplication" className={styles.horizontalInlineLabel} transparent>
          <RadioButtonGroup
            options={DEDUP_OPTIONS.map((dedupType) => ({
              label: capitalize(dedupType),
              value: dedupType,
              description: LogsDedupDescription[dedupType],
            }))}
            value={dedupStrategy}
            onChange={onChangeDedup}
            className={styles.radioButtons}
          />
        </InlineField>
      </InlineFieldRow>

      <div>
        <InlineField label="Display results" className={styles.horizontalInlineLabel} transparent>
          <RadioButtonGroup
            disabled={isFlipping}
            options={[
              {
                label: 'Newest first',
                value: LogsSortOrder.Descending,
                description: 'Show results newest to oldest',
              },
              {
                label: 'Oldest first',
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
    </div>
  );
};
