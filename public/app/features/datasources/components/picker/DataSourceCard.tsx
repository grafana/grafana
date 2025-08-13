import { css, cx } from '@emotion/css';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, TagList, useTheme2, Icon } from '@grafana/ui';

interface DataSourceCardProps {
  ds: DataSourceInstanceSettings;
  onClick: () => void;
  selected: boolean;
  description?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (ds: DataSourceInstanceSettings) => void;
}

export function DataSourceCard({
  ds,
  onClick,
  selected,
  description,
  isFavorite = false,
  onToggleFavorite,
  ...htmlProps
}: DataSourceCardProps) {
  const theme = useTheme2();
  const styles = getStyles(theme, ds.meta.builtIn);

  return (
    <Card
      key={ds.uid}
      onClick={onClick}
      className={cx(styles.card, selected ? styles.selected : undefined)}
      {...htmlProps}
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.headingContent}>
          <span className={styles.name}>
            {ds.name} {ds.isDefault ? <TagList tags={['default']} /> : null}
          </span>
          <div className={styles.rightSection}>
            <small className={styles.type}>{description || ds.meta.name}</small>
            {onToggleFavorite && !ds.meta.builtIn && (
              <Icon
                name={isFavorite ? 'favorite' : 'star'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(ds);
                }}
                className={styles.favoriteButton}
              />
            )}
          </div>
        </div>
      </Card.Heading>
      <Card.Figure className={styles.logo}>
        <img src={ds.meta.info.logos.small} alt={`${ds.meta.name} Logo`} />
      </Card.Figure>
    </Card>
  );
}

// Get styles for the component
function getStyles(theme: GrafanaTheme2, builtIn = false) {
  return {
    card: css({
      cursor: 'pointer',
      backgroundColor: 'transparent',
      // Move to list component
      marginBottom: 0,
      padding: theme.spacing(1),

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    heading: css({
      width: '100%',
      overflow: 'hidden',
      // This is needed to enable ellipsis when text overlfows
      '> button': {
        width: '100%',
      },
    }),
    headingContent: css({
      color: theme.colors.text.secondary,
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    rightSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      flex: 1,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    logo: css({
      width: '32px',
      height: '32px',
      padding: theme.spacing(0, 1),
      display: 'flex',
      alignItems: 'center',

      '> img': {
        maxHeight: '100%',
        minWidth: '24px',
        filter: `invert(${builtIn && theme.isLight ? 1 : 0})`,
      },
    }),
    name: css({
      color: theme.colors.text.primary,
      display: 'flex',
      gap: theme.spacing(2),
    }),
    type: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
    }),
    favoriteButton: css({
      flexShrink: 0,
      pointerEvents: 'auto',
      zIndex: 1,
    }),
    separator: css({
      margin: theme.spacing(0, 1),
      color: theme.colors.border.weak,
    }),
    selected: css({
      background: theme.colors.action.selected,

      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: 0,
      },
    }),
    meta: css({
      display: 'block',
      overflowWrap: 'unset',
      whiteSpace: 'nowrap',
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  };
}
