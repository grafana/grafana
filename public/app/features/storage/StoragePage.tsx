import React, { useCallback, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { NavModelItem } from '@grafana/data';
import { Button, Card, HorizontalGroup, Icon, Spinner } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';

// TODO: get from the server nav model!
const node: NavModelItem = {
  id: 'storage',
  text: 'Storage (SKETCH!)',
  subTitle: 'Configure storage engines for resources',
  icon: 'database-alt',
  url: 'org/storage',
};

export default function StoragePage() {
  const [running, setRunning] = useState(false);

  const doExport = useCallback(() => {
    setRunning(true);
    getBackendSrv()
      .post('api/gitops/export')
      .then((v) => {
        alert(JSON.stringify(v));
        setRunning(false);
      });
  }, [setRunning]);

  const doImport = useCallback(() => {
    setRunning(true);
    getBackendSrv()
      .post('api/gitops/import')
      .then((v) => {
        alert(JSON.stringify(v));
        setRunning(false);
      });
  }, [setRunning]);

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <div>
          <h1>Dashboards</h1>
          <Card heading="SQL (standard)" description="Dashboards stored in SQL database">
            <Card.Meta>sqlite? mysql address?</Card.Meta>
            <Card.Figure>
              <Icon name="database" size="xxxl" />
            </Card.Figure>
          </Card>
          <Card heading="devdash" description="Dashboards from local dev file system">
            <Card.Meta>devenv/dev-dashboards</Card.Meta>
            <Card.Figure>
              <Icon name="folder-open" size="xxxl" />
            </Card.Figure>
          </Card>
          <Card heading="git1" description="Dashboards in git">
            <Card.Meta>
              <a href="https://github.com/grafana/plugin-provisioning">
                git@github.com:grafana/plugin-provisioning.git
              </a>
              <a href="https://github.com/grafana/plugin-provisioning/tree/main/provisioning/dashboards">
                <Icon name="folder" /> provisioning/dashboards
              </a>
            </Card.Meta>
            <Card.Figure>
              <Icon name="code-branch" size="xxxl" />
            </Card.Figure>
          </Card>
          <Card heading="git2" description="Dashboards in git">
            <Card.Meta>
              <a href="https://github.com/grafana/demo_kit">git@github.com:grafana/demo_kit.git</a>
              <a href="https://github.com/grafana/demo_kit/tree/main/grafana/dashboards">
                <Icon name="folder" /> grafana/dashboards
              </a>
            </Card.Meta>
            <Card.Figure>
              <Icon name="code-branch" size="xxxl" />
            </Card.Figure>
          </Card>

          <h1>Data sources</h1>
          <Card heading="SQL (standard)" description="Data source stored in SQL database">
            <Card.Meta>...sqlite...</Card.Meta>
            <Card.Figure>
              <Icon name="database" size="xxxl" />
            </Card.Figure>
          </Card>

          <h1>Resources</h1>
          <Card heading="public" description="standard static files">
            <Card.Meta>public/static</Card.Meta>
            <Card.Figure>
              <Icon name="folder-open" size="xxxl" />
            </Card.Figure>
          </Card>
          <Card heading="Uploads" description="Save uploads in SQL">
            <Card.Meta>...sqlite...</Card.Meta>
            <Card.Figure>
              <Icon name="database" size="xxxl" />
            </Card.Figure>
          </Card>
        </div>

        <div>
          <h1>Actions</h1>
          {running && (
            <div>
              <Spinner />
            </div>
          )}
          {!running && (
            <HorizontalGroup>
              <Button variant="secondary" onClick={doExport}>
                Write system to git
              </Button>

              <Button variant="secondary" onClick={doImport}>
                Load system from git
              </Button>
            </HorizontalGroup>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}
