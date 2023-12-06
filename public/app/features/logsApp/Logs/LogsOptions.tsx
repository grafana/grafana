import React from 'react';

import { Button, Dropdown, Icon, InlineField, InlineSwitch } from '@grafana/ui';

interface Props {
  styles: Record<string, string>;
  showTime: boolean;
  showLabels: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  highlightSearchwords: boolean;
  exploreId: string;
  onChangeTime(value: boolean): void;
  onChangeLabels(value: boolean): void;
  onChangeWrapLogMessage(value: boolean): void;
  onChangePrettifyLogMessage(value: boolean): void;
  onChangeHighlightSearchwords(value: boolean): void;
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
  onChangeHighlightSearchwords,
  prettifyLogMessage,
  highlightSearchwords,
}: Props) => {
  const menu = (
    <div className={styles.logOptionsMenu}>
      <InlineField label="Time" className={styles.logOptionMenuItem} onClick={() => onChangeTime(!showTime)}>
        <InlineSwitch value={showTime} transparent id={`show-time_${exploreId}`} />
      </InlineField>
      <InlineField
        label="Unique labels"
        className={styles.logOptionMenuItem}
        onClick={() => onChangeLabels(!showLabels)}
      >
        <InlineSwitch value={showLabels} transparent id={`unique-labels_${exploreId}`} />
      </InlineField>
      <InlineField
        label="Wrap lines"
        className={styles.logOptionMenuItem}
        onClick={() => onChangeWrapLogMessage(!wrapLogMessage)}
      >
        <InlineSwitch value={wrapLogMessage} transparent id={`wrap-lines_${exploreId}`} />
      </InlineField>
      <InlineField
        label="Prettify JSON"
        className={styles.logOptionMenuItem}
        onClick={() => onChangePrettifyLogMessage(!prettifyLogMessage)}
      >
        <InlineSwitch value={prettifyLogMessage} transparent id={`prettify_${exploreId}`} />
      </InlineField>
      <InlineField
        label="Highlight searchwords"
        className={styles.logOptionMenuItem}
        onClick={() => onChangeHighlightSearchwords(!highlightSearchwords)}
      >
        <InlineSwitch value={highlightSearchwords} transparent />
      </InlineField>
    </div>
  );

  return (
    <Dropdown overlay={menu}>
      <Button size="md" variant="secondary">
        Logs options
        <Icon name="sliders-v-alt" size="md" style={{ marginLeft: '0.5em' }} />
      </Button>
    </Dropdown>
  );
};
