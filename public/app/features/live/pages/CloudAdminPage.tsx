import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { GrafanaCloudBackend } from './types';

export default function CloudAdminPage() {
  const navModel = useNavModel('live-cloud');
  const [cloud, setCloud] = useState<GrafanaCloudBackend[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/write-configs`)
      .then((data) => {
        setCloud(data.writeConfigs);
      })
      .catch((e) => {
        if (e.data) {
          setError(JSON.stringify(e.data, null, 2));
        }
      });
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {error && <pre>{error}</pre>}
        {!cloud && <>Loading cloud definitions</>}
        {cloud &&
          cloud.map((v) => {
            return (
              <div key={v.uid}>
                <h2>{v.uid}</h2>
                <pre className={styles.row}>{JSON.stringify(v.settings, null, 2)}</pre>
              </div>
            );
          })}
      </Page.Contents>
    </Page>
  );
}

const styles = {
  row: css`
    cursor: pointer;
  `,
};
