import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { ConnectionConfig } from '@grafana/aws-sdk';
import {
  rangeUtil,
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  DataSourceTestSucceeded,
  DataSourceTestFailed,
  GrafanaTheme2,
} from '@grafana/data';
import { ConfigSection } from '@grafana/plugin-ui';
import { getAppEvents, usePluginInteractionReporter, getDataSourceSrv, config } from '@grafana/runtime';
import { Alert, Input, FieldProps, Field, Divider, useStyles2 } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { SelectableResourceValue } from '../../resources/types';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../../types';
import { LogGroupsFieldWrapper } from '../shared/LogGroups/LogGroupsField';

import { SecureSocksProxySettingsNewStyling } from './SecureSocksProxySettingsNewStyling';
import { XrayLinkConfig } from './XrayLinkConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

type LogGroupFieldState = Pick<FieldProps, 'invalid'> & { error?: string | null };

export const ARN_DEPRECATION_WARNING_MESSAGE =
  'Since grafana 7.3 authentication type "arn" is deprecated, falling back to default SDK provider';
export const CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE =
  'As of grafana 7.3 authentication type "credentials" should be used only for shared file credentials. \
If you don\'t have a credentials file, switch to the default SDK provider for extracting credentials \
from environment variables or IAM roles';

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { defaultLogGroups, logsTimeout, defaultRegion, logGroups } = options.jsonData;
  const datasource = useDatasource(props);
  const logsTimeoutError = useTimoutValidation(logsTimeout);
  const saved = useDataSourceSavedState(props);
  const [logGroupFieldState, setLogGroupFieldState] = useState<LogGroupFieldState>({
    invalid: false,
  });

  useEffect(() => setLogGroupFieldState({ invalid: false }), [props.options]);
  const report = usePluginInteractionReporter();
  useEffect(() => {
    const successSubscription = getAppEvents().subscribe<DataSourceTestSucceeded>(DataSourceTestSucceeded, () => {
      report('grafana_plugin_cloudwatch_save_succeeded', {
        auth_type: options.jsonData.authType,
      });
    });
    const failSubscription = getAppEvents().subscribe<DataSourceTestFailed>(DataSourceTestFailed, () => {
      report('grafana_plugin_cloudwatch_save_failed', {
        auth_type: options.jsonData.authType,
      });
    });
    return () => {
      successSubscription.unsubscribe();
      failSubscription.unsubscribe();
    };
  }, [options.jsonData.authType, report]);
  const [externalId, setExternalId] = useState('');
  useEffect(() => {
    if (!externalId && datasource) {
      datasource.resources
        .getExternalId()
        .then(setExternalId)
        .catch(() => setExternalId('Unable to fetch externalId'));
    }
  }, [datasource, externalId]);

  const [warning, setWarning] = useState<string | null>(null);
  const dismissWarning = () => {
    setWarning(null);
  };
  useEffect(() => {
    if (options.jsonData.authType === 'arn') {
      setWarning(ARN_DEPRECATION_WARNING_MESSAGE);
    } else if (options.jsonData.authType === 'credentials' && !options.jsonData.profile && !options.jsonData.database) {
      setWarning(CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE);
    }
  }, [options.jsonData.authType, options.jsonData.database, options.jsonData.profile]);

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.formStyles}>
      {warning && (
        <Alert title="CloudWatch Authentication" severity="warning" onRemove={dismissWarning}>
          {warning}
        </Alert>
      )}
      <ConnectionConfig
        {...props}
        loadRegions={
          datasource &&
          (async () => {
            return datasource.resources
              .getRegions()
              .then((regions) =>
                regions.reduce(
                  (acc: string[], curr: SelectableResourceValue) => (curr.value ? [...acc, curr.value] : acc),
                  []
                )
              );
          })
        }
        externalId={externalId}
      >
        <Field label="Namespaces of Custom Metrics">
          <Input
            placeholder="Namespace1,Namespace2"
            value={options.jsonData.customMetricsNamespaces || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'customMetricsNamespaces')}
          />
        </Field>
      </ConnectionConfig>
      {config.secureSocksDSProxyEnabled && (
        <SecureSocksProxySettingsNewStyling options={options} onOptionsChange={onOptionsChange} />
      )}
      <Divider />
      <ConfigSection title="Cloudwatch Logs">
        <Field
          htmlFor="logsTimeout"
          label="Query Result Timeout"
          description='Grafana will poll for Cloudwatch Logs results every second until Done status is returned from AWS or timeout is exceeded, in which case Grafana will return an error. Note: For Alerting, the timeout from Grafana config file will take precedence. Must be a valid duration string, such as "30m" (default) "30s" "2000ms" etc.'
          invalid={Boolean(logsTimeoutError)}
        >
          <Input
            id="logsTimeout"
            width={60}
            placeholder="30m"
            value={options.jsonData.logsTimeout || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'logsTimeout')}
            title={'The timeout must be a valid duration string, such as "15m" "30s" "2000ms" etc.'}
          />
        </Field>
        <Field
          label="Default Log Groups"
          description="Optionally, specify default log groups for CloudWatch Logs queries."
          {...logGroupFieldState}
        >
          {datasource ? (
            <LogGroupsFieldWrapper
              region={defaultRegion ?? ''}
              datasource={datasource}
              onBeforeOpen={() => {
                if (saved) {
                  return;
                }

                let error = 'You need to save the data source before adding log groups.';
                if (props.options.version && props.options.version > 1) {
                  error =
                    'You have unsaved connection detail changes. You need to save the data source before adding log groups.';
                }
                setLogGroupFieldState({
                  invalid: true,
                  error,
                });
                throw new Error(error);
              }}
              legacyLogGroupNames={defaultLogGroups}
              logGroups={logGroups}
              onChange={(updatedLogGroups) => {
                onOptionsChange({
                  ...props.options,
                  jsonData: {
                    ...props.options.jsonData,
                    logGroups: updatedLogGroups,
                    defaultLogGroups: undefined,
                  },
                });
              }}
              maxNoOfVisibleLogGroups={2}
              //legacy props
              legacyOnChange={(logGroups) => {
                updateDatasourcePluginJsonDataOption(props, 'defaultLogGroups', logGroups);
              }}
            />
          ) : (
            <></>
          )}
        </Field>
      </ConfigSection>
      <Divider />
      <XrayLinkConfig
        newFormStyling={true}
        onChange={(uid) => updateDatasourcePluginJsonDataOption(props, 'tracingDatasourceUid', uid)}
        datasourceUid={options.jsonData.tracingDatasourceUid}
      />
    </div>
  );
};

function useDatasource(props: Props) {
  const [datasource, setDatasource] = useState<CloudWatchDatasource>();

  useEffect(() => {
    if (props.options.version) {
      getDataSourceSrv()
        .get(props.options.name)
        .then((datasource) => {
          if (datasource instanceof CloudWatchDatasource) {
            setDatasource(datasource);
          }
        });
    }
  }, [props.options.version, props.options.name]);

  return datasource;
}

function useTimoutValidation(value: string | undefined) {
  const [err, setErr] = useState<undefined | string>(undefined);
  useDebounce(
    () => {
      if (value) {
        try {
          rangeUtil.describeInterval(value);
          setErr(undefined);
        } catch (e) {
          if (e instanceof Error) {
            setErr(e.toString());
          }
        }
      } else {
        setErr(undefined);
      }
    },
    350,
    [value]
  );
  return err;
}

function useDataSourceSavedState(props: Props) {
  const [saved, setSaved] = useState(!!props.options.version && props.options.version > 1);
  useEffect(() => {
    setSaved(false);
  }, [
    props.options.jsonData.assumeRoleArn,
    props.options.jsonData.authType,
    props.options.jsonData.defaultRegion,
    props.options.jsonData.endpoint,
    props.options.jsonData.externalId,
    props.options.jsonData.profile,
    props.options.secureJsonData?.accessKey,
    props.options.secureJsonData?.secretKey,
  ]);

  useEffect(() => {
    props.options.version && props.options.version > 1 && setSaved(true);
  }, [props.options.version]);

  return saved;
}

const getStyles = (theme: GrafanaTheme2) => ({
  formStyles: css({
    maxWidth: theme.spacing(50),
  }),
});
