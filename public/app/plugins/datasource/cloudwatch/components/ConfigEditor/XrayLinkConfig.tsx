import { css } from '@emotion/css';

import { GrafanaTheme2, DataSourceInstanceSettings } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { Alert, Field, InlineField, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css({
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
});

interface Props {
  datasourceUid?: string;
  onChange: (uid: string) => void;
  newFormStyling?: boolean;
}

const xRayDsId = 'grafana-x-ray-datasource';

export function XrayLinkConfig({ newFormStyling, datasourceUid, onChange }: Props) {
  const hasXrayDatasource = Boolean(getDataSourceSrv().getList({ pluginId: xRayDsId }).length);

  const styles = useStyles2(getStyles);

  return newFormStyling ? (
    <ConfigSection
      title="X-ray trace link"
      description="Grafana will automatically create a link to a trace in X-ray data source if logs contain @xrayTraceId field"
    >
      {!hasXrayDatasource && (
        <Alert
          title={
            'There is no X-ray datasource to link to. First add an X-ray data source and then link it to Cloud Watch. '
          }
          severity="info"
        />
      )}
      <Field htmlFor="data-source-picker" label="Data source" description="X-ray data source containing traces">
        <DataSourcePicker
          pluginId={xRayDsId}
          onChange={(ds: DataSourceInstanceSettings) => onChange(ds.uid)}
          current={datasourceUid}
          noDefault={true}
        />
      </Field>
    </ConfigSection>
  ) : (
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
            onChange={(ds: DataSourceInstanceSettings) => onChange(ds.uid)}
            current={datasourceUid}
            noDefault={true}
          />
        </InlineField>
      </div>
    </>
  );
}
