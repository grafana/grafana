import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Alert, InlineField, useStyles2 } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css`
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
});

interface Props {
  datasourceUid?: string;
  onChange: (uid: string) => void;
}

const xRayDsId = 'grafana-x-ray-datasource';

export function XrayLinkConfig({ datasourceUid, onChange }: Props) {
  const hasXrayDatasource = Boolean(getDatasourceSrv().getList({ pluginId: xRayDsId }).length);

  const styles = useStyles2(getStyles);

  return (
    <>
      <h3 className="page-heading">X-ray trace link</h3>

      <div className={styles.infoText}>
        Grafana will automatically create a link to a trace in X-ray data source if logs contain @xrayTraceId field
      </div>

      {!hasXrayDatasource && (
        <Alert
          title={
            'There is no X-ray datasource to link to. First add an X-ray data source and then link it to Cloud Watch. '
          }
          severity="info"
        />
      )}

      <div className="gf-form-group">
        <InlineField
          htmlFor="data-source-picker"
          label="Data source"
          labelWidth={28}
          tooltip="X-ray data source containing traces"
        >
          <DataSourcePicker
            pluginId={xRayDsId}
            onChange={(ds) => onChange(ds.uid)}
            current={datasourceUid}
            noDefault={true}
          />
        </InlineField>
      </div>
    </>
  );
}
