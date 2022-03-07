import { css } from '@emotion/css';
import { Card, Icon, useTheme2 } from '@grafana/ui';
import React from 'react';

export function DashboardList() {
  const theme = useTheme2();

  return (
    <>
      <h4 className={css({ color: theme.colors.text.secondary })}>Dashboards</h4>
      <Card heading="SQL (standard)" description="Dashboards stored in SQL database">
        <Card.Meta>sqlite? mysql address?</Card.Meta>
        <Card.Figure>
          <Icon name="database" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
      <Card heading="devdash" description="Dshboards from local dev file system">
        <Card.Meta>devenv/dev-dashboards</Card.Meta>
        <Card.Figure>
          <Icon name="folder-open" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
      <Card heading="git1" description="Dashboards in git">
        <Card.Meta>
          <a href="https://github.com/grafana/plugin-provisioning">git@github.com:grafana/plugin-provisioning.git</a>
          <a href="https://github.com/grafana/plugin-provisioning/tree/main/provisioning/dashboards">
            <Icon name="folder" className={css({ color: theme.colors.text.secondary })} /> provisioning/dashboards
          </a>
        </Card.Meta>
        <Card.Figure>
          <Icon name="code-branch" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
      <Card heading="git2" description="Dashboards in git">
        <Card.Meta>
          <a href="https://github.com/grafana/demo_kit">git@github.com:grafana/demo_kit.git</a>
          <a href="https://github.com/grafana/demo_kit/tree/main/grafana/dashboards">
            <Icon name="folder" className={css({ color: theme.colors.text.secondary })} /> grafana/dashboards
          </a>
        </Card.Meta>
        <Card.Figure>
          <Icon name="code-branch" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
    </>
  );
}
