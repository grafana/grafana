import React, { FC, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { ConnectionConfig } from '@grafana/aws-sdk';
import {
  rangeUtil,
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginOption,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Input, InlineField, Button } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';

import { SelectableResourceValue } from '../api';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';

import { LogGroupSelector } from './LogGroupSelector';
import { XrayLinkConfig } from './XrayLinkConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const { options } = props;
  const { defaultLogGroups, logsTimeout, defaultRegion } = options.jsonData;
  const didMount = useRef(false);

  useAuthenticationWarning(options.jsonData);
  const logsTimeoutError = useTimeoutValidation(logsTimeout);

  // we offer users a save button after config settings so that
  // users are reminded that subsequent requests for log groups depend upon connection data being up to date
  const [saved, setSaved] = useState(true);
  const saveOptions = async (): Promise<void> => {
    await getBackendSrv()
      .put(`/api/datasources/${options.id}`, options)
      .then((result: { datasource: any }) => {
        updateDatasourcePluginOption(props, 'version', result.datasource.version);
        setSaved(true);
      });
  };

  // we keep track of when the connection config form is dirty and needs to be saved
  // so that we can determine whether or not to disable the save button
  useEffect(() => {
    // skip on mount, we assume on load of page it is already saved
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
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

  const datasource = useDatasource(options.name, saved);

  return (
    <>
      <ConnectionConfig
        {...props}
        loadRegions={
          datasource &&
          (async () => {
            return datasource.api
              .getRegions()
              .then((regions) =>
                regions.reduce(
                  (acc: string[], curr: SelectableResourceValue) => (curr.value ? [...acc, curr.value] : acc),
                  []
                )
              );
          })
        }
      >
        <InlineField label="Namespaces of Custom Metrics" labelWidth={28} tooltip="Namespaces of Custom Metrics.">
          <Input
            width={60}
            placeholder="Namespace1,Namespace2"
            value={options.jsonData.customMetricsNamespaces || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'customMetricsNamespaces')}
          />
        </InlineField>
      </ConnectionConfig>
      <div className="gf-form-group">
        <Button onClick={saveOptions} disabled={saved}>
          Save Connection Details
        </Button>
      </div>
      <h3 className="page-heading">CloudWatch Logs</h3>
      <div className="gf-form-group">
        <InlineField
          label="Timeout"
          labelWidth={28}
          tooltip='Custom timeout for CloudWatch Logs insights queries which have max concurrency limits. Default is 15 minutes. Must be a valid duration string, such as "15m" "30s" "2000ms" etc.'
          invalid={Boolean(logsTimeoutError)}
        >
          <Input
            width={60}
            placeholder="15m"
            value={options.jsonData.logsTimeout || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'logsTimeout')}
            title={'The timeout must be a valid duration string, such as "15m" "30s" "2000ms" etc.'}
          />
        </InlineField>
        <InlineField
          label="Default Log Groups"
          labelWidth={28}
          tooltip="Optionally, specify default log groups for CloudWatch Logs queries."
        >
          <LogGroupSelector
            selectedLogGroups={defaultLogGroups ?? []}
            onChange={(logGroups) => {
              updateDatasourcePluginJsonDataOption(props, 'defaultLogGroups', logGroups);
            }}
            width={60}
            describeLogGroups={(logGroupNamePrefix) => {
              if (!datasource?.api?.describeLogGroups) {
                return;
              }
              return datasource.api.describeLogGroups({
                region: defaultRegion || '',
                logGroupNamePrefix,
              });
            }}
          />
        </InlineField>
      </div>

      <XrayLinkConfig
        onChange={(uid) => updateDatasourcePluginJsonDataOption(props, 'tracingDatasourceUid', uid)}
        datasourceUid={options.jsonData.tracingDatasourceUid}
      />
    </>
  );
};

function useAuthenticationWarning(jsonData: CloudWatchJsonData) {
  const addWarning = (message: string) => {
    store.dispatch(notifyApp(createWarningNotification('CloudWatch Authentication', message)));
  };

  useEffect(() => {
    if (jsonData.authType === 'arn') {
      addWarning('Since grafana 7.3 authentication type "arn" is deprecated, falling back to default SDK provider');
    } else if (jsonData.authType === 'credentials' && !jsonData.profile && !jsonData.database) {
      addWarning(
        'As of grafana 7.3 authentication type "credentials" should be used only for shared file credentials. \
             If you don\'t have a credentials file, switch to the default SDK provider for extracting credentials \
             from environment variables or IAM roles'
      );
    }
  }, [jsonData.authType, jsonData.database, jsonData.profile]);
}

function useDatasource(datasourceName: string, saved: boolean) {
  const [datasource, setDatasource] = useState<CloudWatchDatasource>();
  useEffect(() => {
    // reload the datasource when it's saved
    if (!saved) {
      return;
    }
    getDatasourceSrv()
      .loadDatasource(datasourceName)
      .then((datasource) => {
        // It's really difficult to type .loadDatasource() because it's inherently untyped as it involves two JSON.parse()'s
        // So a "as" type assertion here is a necessary evil.
        setDatasource(datasource as CloudWatchDatasource);
      });
  }, [datasourceName, saved]);

  return datasource;
}

function useTimeoutValidation(value: string | undefined) {
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
