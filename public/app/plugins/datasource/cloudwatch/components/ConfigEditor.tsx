import { unionBy } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { ConnectionConfig } from '@grafana/aws-sdk';
import {
  rangeUtil,
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  SelectableValue,
} from '@grafana/data';
import { Input, InlineField, MultiSelect } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';
import { toOption } from '../utils/utils';

import { XrayLinkConfig } from './XrayLinkConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const { options } = props;
  const { defaultLogGroups, defaultRegion, logsTimeout } = options.jsonData;

  const datasource = useDatasource(options.name);
  useAuthenticationWarning(options.jsonData);
  const logsTimeoutError = useTimoutValidation(logsTimeout);
  const [logGroups, setLogGroups] = useState<SelectableValue[]>([]);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);

  const loadLogGroups =
    datasource &&
    defaultRegion &&
    (() => datasource!.describeLogGroups({ region: defaultRegion }).then((lg) => lg.map(toOption)));
  useAsync(async () => {
    if (loadLogGroups) {
      setLoadingLogGroups(true);
      setLogGroups(await loadLogGroups().finally(() => setLoadingLogGroups(false)));
      return;
    }
  }, [datasource, defaultRegion]);

  return (
    <>
      <ConnectionConfig
        {...props}
        loadRegions={
          datasource &&
          (() => datasource!.getRegions().then((r) => r.filter((r) => r.value !== 'default').map((v) => v.value)))
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
          tooltip="Optional. Default log groups for new CloudWatch Logs queries."
        >
          <MultiSelect
            value={defaultLogGroups}
            width={60}
            onChange={(groups) => {
              updateDatasourcePluginJsonDataOption(
                props,
                'defaultLogGroups',
                groups.map(({ value }) => {
                  return value;
                })
              );
            }}
            options={unionBy(logGroups, defaultLogGroups?.map(toOption), 'value')}
            isLoading={loadingLogGroups}
            allowCustomValue
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

function useDatasource(datasourceName: string) {
  const [datasource, setDatasource] = useState<CloudWatchDatasource>();

  useEffect(() => {
    getDatasourceSrv()
      .loadDatasource(datasourceName)
      .then((datasource) => {
        // It's really difficult to type .loadDatasource() because it's inherently untyped as it involves two JSON.parse()'s
        // So a "as" type assertion here is a necessary evil.
        setDatasource(datasource as CloudWatchDatasource);
      });
  }, [datasourceName]);

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
