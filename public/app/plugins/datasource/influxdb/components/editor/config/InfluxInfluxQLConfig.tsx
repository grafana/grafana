import { css } from '@emotion/css';
import { uniqueId } from 'lodash';

import {
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Alert, Field, InlineLabel, Input, SecretInput, Select, useStyles2 } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

import { WIDTH_SHORT } from './constants';
import {
  trackInfluxDBConfigV1InfluxQLDatabaseInputField,
  trackInfluxDBConfigV1InfluxQLPasswordInputField,
  trackInfluxDBConfigV1InfluxQLUserInputField,
} from './trackingv1';

const httpModes: SelectableValue[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxInfluxQLConfig = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { database, jsonData, secureJsonData, secureJsonFields } = options;
  const styles = useStyles2(getStyles);

  const htmlPrefix = uniqueId('influxdb-influxql-config');

  return (
    <>
      <Alert severity="info" title="Database Access">
        <p>
          Setting the database for this datasource does not deny access to other databases. The InfluxDB query syntax
          allows switching the database in the query. For example:
          <code>SHOW MEASUREMENTS ON _internal</code> or
          <code>SELECT * FROM &quot;_internal&quot;..&quot;database&quot; LIMIT 10</code>
          <br />
          <br />
          To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
        </p>
      </Alert>

      <Field
        horizontal
        label={<InlineLabel width={WIDTH_SHORT}>Database</InlineLabel>}
        className={styles.horizontalField}
        htmlFor={`${htmlPrefix}-db`}
        noMargin
      >
        <Input
          id={`${htmlPrefix}-db`}
          className="width-20"
          value={jsonData.dbName ?? database}
          onChange={(event) => {
            onOptionsChange({
              ...options,
              database: '',
              jsonData: {
                ...jsonData,
                dbName: event.currentTarget.value,
              },
            });
          }}
          onBlur={trackInfluxDBConfigV1InfluxQLDatabaseInputField}
        />
      </Field>
      <Field
        horizontal
        label={<InlineLabel width={WIDTH_SHORT}>User</InlineLabel>}
        className={styles.horizontalField}
        htmlFor={`${htmlPrefix}-user`}
        noMargin
      >
        <Input
          id={`${htmlPrefix}-user`}
          className="width-20"
          value={options.user || ''}
          onChange={onUpdateDatasourceOption(props, 'user')}
          onBlur={trackInfluxDBConfigV1InfluxQLUserInputField}
        />
      </Field>
      <Field
        horizontal
        label={<InlineLabel width={WIDTH_SHORT}>Password</InlineLabel>}
        className={styles.horizontalField}
        noMargin
      >
        <SecretInput
          isConfigured={Boolean(secureJsonFields && secureJsonFields.password)}
          value={secureJsonData?.password || ''}
          label="Password"
          aria-label="Password"
          className="width-20"
          onReset={() => updateDatasourcePluginResetOption(props, 'password')}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          onBlur={trackInfluxDBConfigV1InfluxQLPasswordInputField}
        />
      </Field>
      <Field
        horizontal
        label={
          <InlineLabel
            width={WIDTH_SHORT}
            tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
          will restrict you and return an error if the query is too large."
          >
            HTTP Method
          </InlineLabel>
        }
        htmlFor={`${htmlPrefix}-http-method`}
        className={styles.horizontalField}
        noMargin
      >
        <Select
          inputId={`${htmlPrefix}-http-method`}
          className="width-20"
          value={httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
          options={httpModes}
          defaultValue={options.jsonData.httpMode}
          onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode')}
        />
      </Field>

      <Field
        horizontal
        label={
          <InlineLabel
            width={WIDTH_SHORT}
            tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
          >
            Min time interval
          </InlineLabel>
        }
        className={styles.horizontalField}
        noMargin
      >
        <Input
          className="width-20"
          placeholder="10s"
          value={options.jsonData.timeInterval || ''}
          onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
        />
      </Field>

      <Field
        horizontal
        label={
          <InlineLabel
            width={WIDTH_SHORT}
            tooltip="This time range is used in the query editor's autocomplete to reduce the execution time of tag filter queries."
          >
            Autocomplete range
          </InlineLabel>
        }
        className={styles.horizontalField}
        noMargin
      >
        <Input
          className="width-20"
          placeholder="12h"
          value={options.jsonData.showTagTime || ''}
          onChange={onUpdateDatasourceJsonDataOption(props, 'showTagTime')}
        />
      </Field>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  horizontalField: css({
    justifyContent: 'initial',
    margin: `0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0`,
  }),
});
