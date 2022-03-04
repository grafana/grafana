import React from 'react';
import Page from 'app/core/components/Page/Page';
import { NavModelItem } from '@grafana/data';
import { Button, Card, HorizontalGroup, Icon } from '@grafana/ui';
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
  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <div>
          <h1>Dashboards</h1>
          <Card heading="SQL (standard)" description="Dashboards stored in SQL database">
            <Card.Meta>...sqlite...</Card.Meta>
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
          <Card heading="git" description="Dashboards in git">
            <Card.Meta>devenv/dev-dashboards</Card.Meta>
            <Card.Figure>
              <Icon name="code-branch" size="xxxl" />
            </Card.Figure>
          </Card>
          <Card heading="git" description="Dashboards in git">
            <Card.Meta>devenv/dev-dashboards</Card.Meta>
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
          <HorizontalGroup>
            <Button
              variant="secondary"
              onClick={() => {
                getBackendSrv()
                  .post('api/gitops/export')
                  .then((v) => {
                    alert(JSON.stringify(v));
                  });
              }}
            >
              Write system to git
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                getBackendSrv()
                  .post('api/gitops/import')
                  .then((v) => {
                    alert(JSON.stringify(v));
                  });
              }}
            >
              Load system from git
            </Button>
          </HorizontalGroup>
        </div>
      </Page.Contents>
    </Page>
  );
}
