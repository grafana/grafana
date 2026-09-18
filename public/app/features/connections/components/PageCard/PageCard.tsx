import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Card, Icon, useStyles2 } from '@grafana/ui';

type PageCardProps = {
  title: string;
  description: string;
  icon: IconName;
  url: string;
  index: number;
};

export default function PageCard({ title, description, icon, url, index }: PageCardProps) {
  const styles = useStyles2(getStyles);

  return (
    <Card href={url} className={styles.card} noMargin>
      <Card.Figure className={`${styles.figure} ${index % 2 === 0 ? styles.evenLogo : styles.oddLogo}`}>
        <Icon name={icon} size="xl" />
      </Card.Figure>
      <Card.Heading className={styles.heading}>{title}</Card.Heading>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    width: theme.spacing(48),
  }),
  figure: css({
    objectFit: 'contain',
    width: '47px',
    height: '47px',
    padding: theme.spacing(1.2),
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  heading: css({
    fontSize: theme.typography.h4.fontSize,
  }),
  evenLogo: css({
    color: theme.colors.success.text,
    backgroundColor: theme.colors.success.background,
  }),
  oddLogo: css({
    color: theme.colors.accent.text,
    backgroundColor: theme.colors.accent.background,
  }),
});
