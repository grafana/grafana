import React from 'react';

import { FieldSet, InlineField } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { SQLConnectionLimits } from '../../types';

interface Props<T> {
  onPropertyChanged: (property: keyof T, value?: number) => void;
  labelWidth: number;
  jsonData: SQLConnectionLimits;
}

export const ConnectionLimits = <T extends SQLConnectionLimits>(props: Props<T>) => {
  const { onPropertyChanged, labelWidth, jsonData } = props;

  const onJSONDataNumberChanged = (property: keyof SQLConnectionLimits) => {
    return (number?: number) => {
      if (onPropertyChanged) {
        onPropertyChanged(property, number);
      }
    };
  };

  return (
    <FieldSet label="Connection limits">
      <InlineField
        tooltip={
          <span>
            The maximum number of open connections to the database.If <i>Max idle connections</i> is greater than 0 and
            the <i>Max open connections</i> is less than <i>Max idle connections</i>, then
            <i>Max idle connections</i> will be reduced to match the <i>Max open connections</i> limit. If set to 0,
            there is no limit on the number of open connections.
          </span>
        }
        labelWidth={labelWidth}
        label="Max open"
      >
        <NumberInput
          placeholder="unlimited"
          value={jsonData.maxOpenConns}
          onChange={onJSONDataNumberChanged('maxOpenConns')}
        ></NumberInput>
      </InlineField>
      <InlineField
        tooltip={
          <span>
            The maximum number of connections in the idle connection pool.If <i>Max open connections</i> is greater than
            0 but less than the <i>Max idle connections</i>, then the <i>Max idle connections</i> will be reduced to
            match the <i>Max open connections</i> limit. If set to 0, no idle connections are retained.
          </span>
        }
        labelWidth={labelWidth}
        label="Max idle"
      >
        <NumberInput
          placeholder="2"
          value={jsonData.maxIdleConns}
          onChange={onJSONDataNumberChanged('maxIdleConns')}
        ></NumberInput>
      </InlineField>
      <InlineField
        tooltip="The maximum amount of time in seconds a connection may be reused. If set to 0, connections are reused forever."
        labelWidth={labelWidth}
        label="Max lifetime"
      >
        <NumberInput
          placeholder="14400"
          value={jsonData.connMaxLifetime}
          onChange={onJSONDataNumberChanged('connMaxLifetime')}
        ></NumberInput>
      </InlineField>
    </FieldSet>
  );
};
