import React, { FC, useEffect, useState } from 'react';
import { useDebounce, useEffectOnce } from 'react-use';

import { ConnectionConfig } from '@grafana/aws-sdk';
import {
  rangeUtil,
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Input, InlineField } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';

import { SelectableResourceValue } from '../api';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';

import { LogGroupsField } from './LogGroups/LogGroupsField';
import { XrayLinkConfig } from './XrayLinkConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { defaultLogGroups, logsTimeout, defaultRegion, logGroups } = options.jsonData;

  const datasource = useDatasource(props);
  useAuthenticationWarning(options.jsonData);
  const logsTimeoutError = useTimoutValidation(logsTimeout);

  return (
    <>
      <ConnectionConfig
        {...props}
        labelWidth={29}
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
        <InlineField label="Namespaces of Custom Metrics" labelWidth={29} tooltip="Namespaces of Custom Metrics.">
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
          tooltip="Optionally, specify default log groups for CloudWatch Logs queries."
          shrink={true}
        >
          {datasource ? (
            <LogGroupsField
              region={defaultRegion ?? ''}
              datasource={datasource}
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
            />
          ) : (
            <></>
          )}
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

function useDatasource(props: Props) {
  const [datasource, setDatasource] = useState<CloudWatchDatasource>();

  useEffectOnce(() => {
    // save the datasource if it wasn't saved before
    if (props.options.version === 1) {
      getBackendSrv()
        .put(`/api/datasources/${props.options.id}`, props.options)
        .then((result) => {
          props.onOptionsChange({
            ...props.options,
            version: result.datasource.version,
          });
        });
    }
  });

  useEffect(() => {
    if (props.options.version && props.options.version > 1) {
      getDatasourceSrv()
        .loadDatasource(props.options.name)
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
