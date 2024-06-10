import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, QueryEditorProps, TimeRange } from '@grafana/data';
import { getBackendSrv, getPluginLinkExtensions } from '@grafana/runtime';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { PyroscopeDataSource } from '../datasource';
import { PyroscopeDataSourceOptions, Query } from '../types';

const EXTENSION_POINT_ID = 'plugins/grafana-pyroscope-datasource/query-links';

/** A subset of the datasource settings that are relevant for this integration */
type PyroscopeDatasourceSettings = {
  uid: string;
  url: string;
  type: string;
  basicAuthUser: string;
};

/** The context object that will be shared with the link extension's configure function */
type ExtensionQueryLinksContext = {
  datasourceUid: string;
  query: Query;
  range?: TimeRange | undefined;
  datasourceSettings?: PyroscopeDatasourceSettings;
};

/* Global promises to fetch pyroscope datasource settings by uid as encountered */
const pyroscopeDatasourceSettingsByUid: Record<string, PyroscopeDatasourceSettings> = {};

/* Reset promises for testing purposes */
export function resetPyroscopeQueryLinkExtensionsFetches() {
  Object.keys(pyroscopeDatasourceSettingsByUid).forEach((key) => delete pyroscopeDatasourceSettingsByUid[key]);
}

/** A subset of the `PyroscopeDataSource` `QueryEditorProps` */
export type Props = Pick<
  QueryEditorProps<PyroscopeDataSource, Query, PyroscopeDataSourceOptions>,
  'datasource' | 'query' | 'range'
>;

export function PyroscopeQueryLinkExtensions(props: Props) {
  const {
    datasource: { uid: datasourceUid },
    query,
    range,
  } = props;

  const { value: datasourceSettings } = useAsync(async () => {
    if (pyroscopeDatasourceSettingsByUid[datasourceUid]) {
      return pyroscopeDatasourceSettingsByUid[datasourceUid];
    }
    const settings = await getBackendSrv().get<PyroscopeDatasourceSettings>(`/api/datasources/uid/${datasourceUid}`);
    pyroscopeDatasourceSettingsByUid[datasourceUid] = settings;
    return settings;
  }, [datasourceUid]);

  const context: ExtensionQueryLinksContext = {
    datasourceUid,
    query,
    range,
    datasourceSettings,
  };

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: EXTENSION_POINT_ID,
    context,
  });

  const styles = useStyles2(getStyles);

  if (extensions.length === 0) {
    return null;
  }

  return (
    <>
      {extensions.map((extension) => (
        <LinkButton
          className={styles.linkButton}
          key={`${extension.id}`}
          variant="secondary"
          icon={extension.icon || 'external-link-alt'}
          tooltip={extension.description}
          target="_blank"
          href={extension.path}
          onClick={extension.onClick}
        >
          {extension.title}
        </LinkButton>
      ))}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkButton: css({
      marginLeft: theme.spacing(1),
    }),
  };
}
