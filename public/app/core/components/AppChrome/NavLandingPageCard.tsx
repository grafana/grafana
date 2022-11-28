import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, IconName, useStyles2 } from '@grafana/ui';

interface Props {
  description?: string;
  icon?: IconName;
  text: string;
  url: string;
}

export function NavLandingPageCard({ description, icon, text, url }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <Card className={styles.card} href={url}>
      <Card.Heading>{text}</Card.Heading>
      <Card.Figure align={'center'}>{icon && <Icon name={icon} size="xxxl" />}</Card.Figure>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    marginBottom: 0,
  }),
});
