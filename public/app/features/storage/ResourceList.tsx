import { css } from '@emotion/css';
import { Card, Icon, useTheme2 } from '@grafana/ui';
import React from 'react';

export default function ResourceList() {
  const theme = useTheme2();

  return (
    <>
      <h4 className={css({ color: theme.colors.text.secondary })}>Resources</h4>
      <Card heading="public" description="standard static files">
        <Card.Meta>public/static</Card.Meta>
        <Card.Figure>
          <Icon name="folder-open" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
      <Card heading="Uploads" description="Save uploads in SQL">
        <Card.Meta>...sqlite...</Card.Meta>
        <Card.Figure>
          <Icon name="database" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
    </>
  );
}
