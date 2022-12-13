import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { useStyles2, Spinner, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

interface RouteParams {
  // path: string;
}

interface QueryParams {
  // view: StorageView;
}

interface Props extends GrafanaRouteComponentProps<RouteParams, QueryParams> {}

export default function K8SPage(props: Props) {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('k8s');
  const info = useAsync(() => {
    return getBackendSrv().get('/api/k8s/info');
  });

  const renderView = () => {
    if (info.value) {
      return <pre>{JSON.stringify(info.value, null, 2)}</pre>;
    }
    if (info.loading) {
      return <Spinner />;
    }

    return (
      <div className={styles.wrapper}>
        <Alert title="No k8s client configured." severity="warning" />
        At startup, a service tries to load a client using:
        <ul>
          <li>
            Default
            <a href="https://github.com/kubernetes/client-go/blob/master/rest/config.go#L511">in cluster</a> configs
          </li>
          <li>$HOME/.kube/config, perhaps with minikube running</li>
        </ul>
      </div>
    );
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={info.loading}>{renderView()}</Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: block;
  `,
});
