import { css } from '@emotion/css';
import { Card, Icon, useTheme2 } from '@grafana/ui';
import React from 'react';

export default function DataSourceList() {
  const theme = useTheme2();

  return (
    <>
      <h4 className={css({ color: theme.colors.text.secondary })}>Data sources</h4>
      <Card description="Data source stored in SQL database">
        <Card.Heading>SQL (standard)</Card.Heading>
        <Card.Meta>...sqlite...</Card.Meta>
        <Card.Figure>
          <Icon name="database" size="xxxl" className={css({ color: theme.colors.text.secondary })} />
        </Card.Figure>
      </Card>
    </>
  );
}
