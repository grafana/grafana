import React, { ChangeEvent } from 'react';
import { InlineLabel, InlineFieldRow, InlineField, Input, useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { QuerySettingsProps } from './types';

export const DruidQueryLogSettings = (props: QuerySettingsProps) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { options, onOptionsChange } = props;
  const { settings } = options;
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, settings: { ...settings, [event.target.name]: event.target.value } });
  };
  return (
    <>
      <InlineLabel tooltip="Map Druid dimensions with Grafana log columns" width="auto">
        Log columns mapping
      </InlineLabel>
      <InlineFieldRow className={cx(styles.row)}>
        <InlineFieldRow className={cx(styles.row)}>
          <InlineField labelWidth={10} label="Time">
            <Input
              name="logColumnTime"
              placeholder="The log time dimension name"
              width={30}
              onChange={onInputChange}
              value={settings.logColumnTime}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow className={cx(styles.row)}>
          <InlineField labelWidth={10} label="Level">
            <Input
              name="logColumnLevel"
              placeholder="The log level dimension name"
              width={30}
              onChange={onInputChange}
              value={settings.logColumnLevel}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow className={cx(styles.row)}>
          <InlineField labelWidth={10} label="Message">
            <Input
              name="logColumnMessage"
              placeholder="The log message dimension name"
              width={30}
              onChange={onInputChange}
              value={settings.logColumnMessage}
            />
          </InlineField>
        </InlineFieldRow>
      </InlineFieldRow>
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    row: css`
      width: 100%;
      & > & {
        border-left: 1px solid ${theme.colors.border2};
        padding: 5px 0px 0px 10px;
      }
    `,
  };
});
