import React, { FC, useEffect, useState } from 'react';
import { Input, InlineField } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOption } from '@grafana/data';
import { ConnectionConfig } from '@grafana/aws-sdk';

import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';

import { CloudWatchJsonData, CloudWatchSecureJsonData } from '../types';
import { CloudWatchDatasource } from '../datasource';

export type Props = DataSourcePluginOptionsEditorProps<CloudWatchJsonData, CloudWatchSecureJsonData>;

export const ConfigEditor: FC<Props> = (props: Props) => {
  const [datasource, setDatasource] = useState<CloudWatchDatasource>();
  const { options } = props;

  const addWarning = (message: string) => {
    store.dispatch(notifyApp(createWarningNotification('CloudWatch Authentication', message)));
  };

  useEffect(() => {
    getDatasourceSrv()
      .loadDatasource(options.name)
      .then((datasource: CloudWatchDatasource) => setDatasource(datasource));

    if (options.jsonData.authType === 'arn') {
      addWarning('Since grafana 7.3 authentication type "arn" is deprecated, falling back to default SDK provider');
    } else if (options.jsonData.authType === 'credentials' && !options.jsonData.profile && !options.jsonData.database) {
      addWarning(
        'As of grafana 7.3 authentication type "credentials" should be used only for shared file credentials. \
             If you don\'t have a credentials file, switch to the default SDK provider for extracting credentials \
             from environment variables or IAM roles'
      );
    }
  }, [options.jsonData.authType, options.jsonData.database, options.jsonData.profile, options.name]);

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
    </>
  );
};
