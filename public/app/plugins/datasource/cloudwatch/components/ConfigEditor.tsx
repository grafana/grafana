import React, { FC, useEffect, useState } from 'react';
import { InlineFormLabel, Input } from '@grafana/ui';
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

  const addWarning = (message: string) => {
    store.dispatch(notifyApp(createWarningNotification('CloudWatch Authentication', message)));
  };

  useEffect(() => {
    getDatasourceSrv()
      .loadDatasource(props.options.name)
      .then((datasource: CloudWatchDatasource) => setDatasource(datasource));

    if (props.options.jsonData.authType === 'arn') {
      addWarning('Since grafana 7.3 authentication type "arn" is deprecated, falling back to default SDK provider');
    } else if (
      props.options.jsonData.authType === 'credentials' &&
      !props.options.jsonData.profile &&
      !props.options.jsonData.database
    ) {
      addWarning(
        'As of grafana 7.3 authentication type "credentials" should be used only for shared file credentials. \
             If you don\'t have a credentials file, switch to the default SDK provider for extracting credentials \
             from environment variables or IAM roles'
      );
    }
  }, []);

  if (!datasource) {
    return null;
  }

  return (
    <>
      <ConnectionConfig
        {...props}
        loadRegions={() =>
          datasource!.getRegions().then((r) => r.filter((r) => r.value !== 'default').map((v) => v.value))
        }
      />
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel className="width-14" tooltip="Namespaces of Custom Metrics.">
            Custom Metrics
          </InlineFormLabel>
          <Input
            className="width-30"
            placeholder="Namespace1,Namespace2"
            value={props.options.jsonData.customMetricsNamespaces || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'customMetricsNamespaces')}
          />
        </div>
      </div>
    </>
  );
};
