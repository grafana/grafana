import React from "react";

import { Button, Dropdown, Icon, InlineField, InlineSwitch } from "@grafana/ui";

interface Props {
  styles: Record<string, string>;
  showTime: boolean;
  showLabels: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  exploreId: string;
  onChangeTime(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangeLabels(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangeWrapLogMessage(event: React.ChangeEvent<HTMLInputElement>): void;
  onChangePrettifyLogMessage(event: React.ChangeEvent<HTMLInputElement>): void;
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
