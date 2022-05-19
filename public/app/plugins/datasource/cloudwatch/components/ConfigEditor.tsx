import { unionBy } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { ConnectionConfig } from '@grafana/aws-sdk';
import {
  rangeUtil,
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  SelectableValue,
  updateDatasourcePluginOption,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Input, InlineField, MultiSelect } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { dispatch, store } from 'app/store/store';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';
import { toOption } from '../utils/utils';

import { MAX_LOG_GROUPS, MAX_VISIBLE_LOG_GROUPS } from './LogsQueryField';
import { XrayLinkConfig } from './XrayLinkConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const { options } = props;
  const { defaultLogGroups, logsTimeout } = options.jsonData;

  const { datasource, setSaved } = useDatasource(options.name);
  useAuthenticationWarning(options.jsonData);
  const logsTimeoutError = useTimoutValidation(logsTimeout);
  const [logGroups, setLogGroups] = useState<SelectableValue[]>([]);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);

  const saveOptions = async (): Promise<void> => {
    await getBackendSrv()
      .put(`/api/datasources/${options.id}`, options)
      .then((result: { datasource: any }) => {
        updateDatasourcePluginOption(props, 'version', result.datasource.version);
      });
    setSaved(true);
  };

  const loadLogGroups = async () => {
    await saveOptions();

    // Don't call describeLogGroups if datasource or region doesn't exist
    if (!datasource || !datasource.getActualRegion()) {
      const missingConfig = !datasource ? 'Datasource' : 'Region';
      dispatch(notifyApp(createErrorNotification(`Failed to get log groups: ${missingConfig} not configured`)));
      setLogGroups([]);
      return;
    }

    setLoadingLogGroups(true);
    try {
      const groups = await datasource
        .describeLogGroups({ region: datasource.getActualRegion() })
        .then((lg) => lg.map(toOption));
      setLogGroups(groups);
    } catch (err) {
      let errMessage = 'unknown error';
      if (typeof err !== 'string') {
        try {
          errMessage = JSON.stringify(err);
        } catch (e) {}
      } else {
        errMessage = err;
      }
      dispatch(notifyApp(createErrorNotification(errMessage)));
      setLogGroups([]);
    }
    setLoadingLogGroups(false);
  };

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
          tooltip="Optionally, specify default log groups for CloudWatch Logs queries."
        >
          <MultiSelect
            inputId="default-log-groups"
            value={defaultLogGroups ?? []}
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
            onOpenMenu={loadLogGroups}
            isOptionDisabled={() => !!defaultLogGroups && defaultLogGroups.length >= MAX_LOG_GROUPS}
            placeholder="Choose Log Groups"
            maxVisibleValues={MAX_VISIBLE_LOG_GROUPS}
            noOptionsMessage="No log groups available"
            aria-label="Log Groups"
            isClearable={true}
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
  // If saveOptions is called, the datasource needs to be reloaded
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDatasourceSrv()
      .loadDatasource(datasourceName)
      .then((datasource) => {
        // It's really difficult to type .loadDatasource() because it's inherently untyped as it involves two JSON.parse()'s
        // So a "as" type assertion here is a necessary evil.
        setDatasource(datasource as CloudWatchDatasource);
      });
    setSaved(false);
  }, [datasourceName, saved]);

  return { datasource, setSaved };
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
