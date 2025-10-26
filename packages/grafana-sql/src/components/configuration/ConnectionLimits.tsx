import { DataSourceSettings } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Field, Icon, InlineLabel, Label, Stack, Switch, Tooltip } from '@grafana/ui';

import { SQLConnectionLimits, SQLOptions } from '../../types';

import { MaxLifetimeField } from './MaxLifetimeField';
import { MaxOpenConnectionsField } from './MaxOpenConnectionsField';
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
    <ConfigSubSection
      title={t('grafana-sql.components.connection-limits.title-connection-limits', 'Connection limits')}
    >
      <MaxOpenConnectionsField
        labelWidth={labelWidth}
        onMaxConnectionsChanged={onMaxConnectionsChanged}
        jsonData={jsonData}
      />

      <Field
        label={
          <Label>
            <Stack gap={0.5}>
              <span>
                <Trans i18nKey="grafana-sql.components.connection-limits.auto-max-idle">Auto max idle</Trans>
              </span>
              <Tooltip
                content={
                  <span>
                    <Trans
                      i18nKey="grafana-sql.components.connection-limits.content-auto-max-idle"
                      values={{ defaultMaxIdle: config.sqlConnectionLimits.maxIdleConns }}
                    >
                      If enabled, automatically set the number of <i>Maximum idle connections</i> to the same value as
                      <i> Max open connections</i>. If the number of maximum open connections is not set it will be set
                      to the default ({'{{defaultMaxIdle}}'}).
                    </Trans>
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
              <span>
                <Trans i18nKey="grafana-sql.components.connection-limits.max-idle">Max idle</Trans>
              </span>
              <Tooltip
                content={
                  <span>
                    <Trans i18nKey="grafana-sql.components.connection-limits.content-max-idle">
                      The maximum number of connections in the idle connection pool.If <i>Max open connections</i> is
                      greater than 0 but less than the <i>Max idle connections</i>, then the <i>Max idle connections</i>{' '}
                      will be reduced to match the <i>Max open connections</i> limit. If set to 0, no idle connections
                      are retained.
                    </Trans>
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

      <MaxLifetimeField
        labelWidth={labelWidth}
        onMaxLifetimeChanged={onJSONDataNumberChanged('connMaxLifetime')}
        jsonData={jsonData}
      />
    </ConfigSubSection>
  );
};
