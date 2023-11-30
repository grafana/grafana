import { css, cx } from '@emotion/css';
import React from 'react';

import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, Input, TagsInput } from '@grafana/ui';

import { PROM_CONFIG_LABEL_WIDTH } from '../ConfigEditor';

import { Config, OnChangeHandler } from './ConnectionSettings';

// THIS FILE IS COPIED FROM GRAFANA/EXPERIMENTAL
// BECAUSE THE STYLES DO NOT MATCH THE PROM CONFIG
// THE TYPES ARE WRITTEN THERE WHERE THEY ARE NOT AS STRICT
// @ts-ignore
export type Props<C extends Config = Config> = {
  config: C;
  onChange: OnChangeHandler<C>;
  className?: string;
};
// @ts-ignore
export const AdvancedHttpSettings: <C extends Config = Config>(props: Props<C>) => JSX.Element = ({
  config,
  onChange,
  className,
}) => {
  const onCookiesChange = (cookies: string[]) => {
    onChange({
      ...config,
      jsonData: {
        ...config.jsonData,
        keepCookies: cookies,
      },
    });
  };

  const onTimeoutChange = (event: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...config,
      jsonData: {
        ...config.jsonData,
        timeout: parseInt(event.currentTarget.value, 10),
      },
    });
  };

  const styles = {
    container: css({
      maxWidth: 578,
    }),
  };

  return (
    <>
      <ConfigSubSection title="Advanced HTTP settings" className={cx(styles.container, className)}>
        <InlineField
          htmlFor="advanced-http-cookies"
          label="Allowed cookies"
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip="Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source."
          disabled={config.readOnly}
          grow
        >
          <TagsInput
            className="width-20"
            id="advanced-http-cookies"
            placeholder="New cookie (hit enter to add)"
            tags={config.jsonData.keepCookies}
            onChange={onCookiesChange}
          />
        </InlineField>
        <InlineField
          htmlFor="advanced-http-timeout"
          label="Timeout"
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip="HTTP request timeout in seconds"
          disabled={config.readOnly}
          grow
        >
          <Input
            className="width-20"
            id="advanced-http-timeout"
            type="number"
            min={0}
            placeholder="Timeout in seconds"
            aria-label="Timeout in seconds"
            value={config.jsonData.timeout}
            onChange={onTimeoutChange}
          />
        </InlineField>
      </ConfigSubSection>
    </>
  );
};
