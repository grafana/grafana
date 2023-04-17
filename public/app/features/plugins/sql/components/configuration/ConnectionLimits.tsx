import React from 'react';

import { DataSourceSettings } from '@grafana/data';
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { SQLConnectionDefaults } from '../../constants';
import { SQLConnectionLimits, SQLOptions } from '../../types';

interface Props<T> {
  onOptionsChange: Function;
  options: DataSourceSettings<SQLOptions>;
  labelWidth: number;
}

export const ConnectionLimits = <T extends SQLConnectionLimits>(props: Props<T>) => {
  const { onOptionsChange, options, labelWidth } = props;
  const jsonData = options.jsonData;
  const autoIdle = jsonData.maxIdleConnsAuto !== undefined ? jsonData.maxIdleConnsAuto : false;

  // Update JSON data with new values
  const updateJsonData = (values: {}) => {
    const newOpts = {
      ...options,
      jsonData: {
        ...jsonData,
        ...values,
      },
    };

    return onOptionsChange(newOpts);
  };

  // For the case of idle connections and connection lifetime
  // use a shared function to update respective properties
  const onJSONDataNumberChanged = (property: keyof SQLConnectionLimits) => {
    return (number?: number) => {
      updateJsonData({ property: number });
    };
  };

  // When the maximum number of connections is changed
  // see if we have the automatic idle option enabled
  const onMaxConnectionsChanged = (number?: number) => {
    if (autoIdle && number) {
      updateJsonData({
        maxOpenConns: number,
        maxIdleConns: number,
      });
    } else if (number !== undefined) {
      updateJsonData({
        maxOpenConns: number,
      });
    }
  };

  // Update auto idle setting when control is toggled
  // and set minimum idle connections if automatic
  // is selected
  const onConnectionIdleAutoChanged = () => {
    let idleConns = undefined;
    let maxConns = undefined;

    // If the maximum number of open connections is undefined
    // and we're setting auto idle then set the default amount
    // otherwise take the numeric amount and get the value from that
    if (!autoIdle) {
      if (jsonData.maxOpenConns !== undefined) {
        maxConns = jsonData.maxOpenConns;
        idleConns = jsonData.maxOpenConns;
      } else {
        maxConns = SQLConnectionDefaults.MAX_CONNS;
        idleConns = SQLConnectionDefaults.MAX_CONNS;
      }
    }

    updateJsonData({
      maxIdleConnsAuto: !autoIdle,
      maxIdleConns: idleConns,
      maxOpenConns: maxConns,
    });
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
        <NumberInput placeholder="unlimited" value={jsonData.maxOpenConns} onChange={onMaxConnectionsChanged} />
      </InlineField>
      <InlineFieldRow>
        <InlineField
          tooltip={
            <span>
              The maximum number of connections in the idle connection pool.If <i>Max open connections</i> is greater
              than 0 but less than the <i>Max idle connections</i>, then the <i>Max idle connections</i> will be reduced
              to match the <i>Max open connections</i> limit. If set to 0, no idle connections are retained.
            </span>
          }
          labelWidth={labelWidth}
          label="Max idle"
        >
          <NumberInput
            placeholder="2"
            value={jsonData.maxIdleConns}
            onChange={onJSONDataNumberChanged('maxIdleConns')}
            width={8}
            fieldDisabled={autoIdle}
          />
        </InlineField>
        <InlineField
          label="Auto"
          labelWidth={8}
          tooltip={
            <span>
              If enabled, automatically set the number of <i>Maximum idle connections</i> to the same value as
              <i> Max open connections</i>. If the number of maximum open connections is not set it will be set to the
              default ({SQLConnectionDefaults.MAX_CONNS}).
            </span>
          }
        >
          <InlineSwitch value={autoIdle} onChange={onConnectionIdleAutoChanged} />
        </InlineField>
      </InlineFieldRow>
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
