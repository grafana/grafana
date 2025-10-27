import { css, cx } from '@emotion/css';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, Stack, TagList, Text, useTheme2 } from '@grafana/ui';

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
      noMargin
      onClick={onClick}
      className={cx(styles.card, selected ? styles.selected : undefined)}
      {...htmlProps}
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.headingContent}>
          <Stack direction="row" gap={2} alignItems="center" minWidth={0}>
            <Text color="primary" truncate>
              {ds.name}
            </Text>
            {ds.isDefault && <TagList tags={['default']} />}
          </Stack>
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            justifyContent={{
              xs: 'flex-start',
              sm: 'flex-end',
            }}
            minWidth={0}
            flex={1}
          >
            <Text color="secondary" variant="bodySmall" truncate>
              {description || ds.meta.name}
            </Text>
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
          </Stack>
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
      padding: theme.spacing(1),

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    heading: css({
      width: '100%',
      overflow: 'hidden',
      // This is needed to enable ellipsis when text overflows
      '> button': {
        width: '100%',
      },
    }),
    headingContent: css({
      color: theme.colors.text.secondary,
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      columnGap: theme.spacing(1),
      alignItems: 'center',

      [theme.breakpoints.down('sm')]: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'repeat(2, 1fr)',
      },
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
