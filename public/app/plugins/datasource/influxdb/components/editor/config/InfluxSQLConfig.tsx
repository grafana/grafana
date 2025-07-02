import { css } from '@emotion/css';
import { uniqueId } from 'lodash';

import {
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Field, InlineLabel, InlineSwitch, Input, SecretInput, useStyles2 } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

import { WIDTH_SHORT } from './constants';
import { trackInfluxDBConfigV1SQLDatabaseInputField, trackInfluxDBConfigV1SQLTokenInputField } from './trackingv1';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxSqlConfig = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { jsonData, secureJsonData, secureJsonFields } = options;
  const styles = useStyles2(getStyles);
  const htmlPrefix = uniqueId('influxdb-sql-config');

  return (
    <div>
      <Field
        horizontal
        label={<InlineLabel width={WIDTH_SHORT}>Database</InlineLabel>}
        className={styles.horizontalField}
        htmlFor={`${htmlPrefix}-dbName`}
      >
        <Input
          id={`${htmlPrefix}-dbName`}
          className="width-20"
          aria-label="Database or bucket name"
          value={jsonData.dbName}
          onChange={(event) => {
            onOptionsChange({
              ...options,
              jsonData: {
                ...jsonData,
                dbName: event.currentTarget.value,
              },
            });
          }}
          onBlur={trackInfluxDBConfigV1SQLDatabaseInputField}
        />
      </Field>
      <Field horizontal label={<InlineLabel width={WIDTH_SHORT}>Token</InlineLabel>} className={styles.horizontalField}>
        <SecretInput
          label="Token"
          aria-label="Token"
          className="width-20"
          value={secureJsonData?.token || ''}
          onReset={() => updateDatasourcePluginResetOption(props, 'token')}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
          onBlur={trackInfluxDBConfigV1SQLTokenInputField}
        />
      </Field>
      <Field
        horizontal
        label={<InlineLabel width={WIDTH_SHORT}>Insecure Connection</InlineLabel>}
        className={styles.horizontalField}
      >
        <InlineSwitch
          id={`${htmlPrefix}-insecure-grpc`}
          value={jsonData.insecureGrpc ?? false}
          onChange={(event) => {
            onOptionsChange({
              ...options,
              jsonData: {
                ...jsonData,
                insecureGrpc: event.currentTarget.checked,
              },
            });
          }}
        />
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  horizontalField: css({
    justifyContent: 'initial',
    margin: `0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0`,
  }),
});
