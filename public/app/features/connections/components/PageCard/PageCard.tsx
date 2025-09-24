import { css } from '@emotion/css';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';

type PageCardProps = {
  title: string;
  description: string;
  icon: IconName;
  url: string;
  index: number;
};

export default function PageCard({ title, description, icon, url, index }: PageCardProps) {
  const styles = useStyles2(getStyles);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      locationService.push(url);
    }
  };

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => locationService.push(url)}
      onKeyDown={onKeyDown}
    >
      <Icon name={icon} className={`${styles.logo} ${index % 2 === 0 ? styles.evenLogo : styles.oddLogo}`} />
      <div className={styles.contentColumn}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(3)} ${theme.spacing(4)} ${theme.spacing(2.25)} ${theme.spacing(4)}`,
    minHeight: theme.spacing(19.4),
    '&:hover': {
      cursor: 'pointer',
      backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
    },
    width: theme.spacing(48),
  }),
  contentColumn: css({
    flex: 1,
  }),
  title: css({
    marginBottom: theme.spacing(1),
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: theme.colors.text.primary,
  }),
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
    margin: '0',
    color: theme.colors.text.secondary,
  }),
  logo: css({
    objectFit: 'contain',
    width: '47px',
    height: '47px',
    padding: theme.spacing(1.2),
    borderRadius: theme.spacing(1),
  }),
  evenLogo: css({
    color: '#4ADE80',
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
  }),
  oddLogo: css({
    color: '#FB923C',
    backgroundColor: 'rgba(249, 115, 22, 0.10)',
  }),
});
