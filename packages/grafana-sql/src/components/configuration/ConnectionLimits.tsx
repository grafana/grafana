import { DataSourceSettings } from '@grafana/data';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Field, Icon, InlineLabel, Label, Stack, Switch, Tooltip } from '@grafana/ui';

import { SQLConnectionLimits, SQLOptions } from '../../types';

import { NumberInput } from './NumberInput';

interface Props<T> {
  onOptionsChange: Function;
  options: DataSourceSettings<SQLOptions>;
}

export const ConnectionLimits = <T extends SQLConnectionLimits>(props: Props<T>) => {
  const { onOptionsChange, options } = props;
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
      updateJsonData({ [property]: number });
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
    } else {
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
      }
    } else {
      maxConns = jsonData.maxOpenConns;
      idleConns = jsonData.maxIdleConns;
    }

    updateJsonData({
      maxIdleConnsAuto: !autoIdle,
      maxIdleConns: idleConns,
      maxOpenConns: maxConns,
    });
  };

  const labelWidth = 40;

  return (
    <ConfigSubSection title="Connection limits">
      <Field
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Max open</span>
              <Tooltip
                content={
                  <span>
                    The maximum number of open connections to the database. If <i>Max idle connections</i> is greater
                    than 0 and the <i>Max open connections</i> is less than <i>Max idle connections</i>, then
                    <i>Max idle connections</i> will be reduced to match the <i>Max open connections</i> limit. If set
                    to 0, there is no limit on the number of open connections.
                  </span>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
      >
        <NumberInput
          value={jsonData.maxOpenConns}
          defaultValue={config.sqlConnectionLimits.maxOpenConns}
          onChange={(value) => {
            onMaxConnectionsChanged(value);
          }}
          width={labelWidth}
        />
      </Field>

      <Field
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Auto max idle</span>
              <Tooltip
                content={
                  <span>
                    If enabled, automatically set the number of <i>Maximum idle connections</i> to the same value as
                    <i> Max open connections</i>. If the number of maximum open connections is not set it will be set to
                    the default ({config.sqlConnectionLimits.maxIdleConns}).
                  </span>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
      >
        <Switch value={autoIdle} onChange={onConnectionIdleAutoChanged} />
      </Field>

      <Field
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Max idle</span>
              <Tooltip
                content={
                  <span>
                    The maximum number of connections in the idle connection pool.If <i>Max open connections</i> is
                    greater than 0 but less than the <i>Max idle connections</i>, then the <i>Max idle connections</i>{' '}
                    will be reduced to match the <i>Max open connections</i> limit. If set to 0, no idle connections are
                    retained.
                  </span>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
      >
        {autoIdle ? (
          <InlineLabel width={labelWidth}>{options.jsonData.maxIdleConns}</InlineLabel>
        ) : (
          <NumberInput
            value={jsonData.maxIdleConns}
            defaultValue={config.sqlConnectionLimits.maxIdleConns}
            onChange={(value) => {
              onJSONDataNumberChanged('maxIdleConns')(value);
            }}
            width={labelWidth}
          />
        )}
      </Field>

      <Field
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Max lifetime</span>
              <Tooltip
                content={
                  <span>
                    The maximum amount of time in seconds a connection may be reused. If set to 0, connections are
                    reused forever.
                  </span>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
      >
        <NumberInput
          value={jsonData.connMaxLifetime}
          defaultValue={config.sqlConnectionLimits.connMaxLifetime}
          onChange={(value) => {
            onJSONDataNumberChanged('connMaxLifetime')(value);
          }}
          width={labelWidth}
        />
      </Field>
    </ConfigSubSection>
  );
};
