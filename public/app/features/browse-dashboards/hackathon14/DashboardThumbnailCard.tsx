import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Card, Stack, Text, useStyles2, Icon, Spinner } from '@grafana/ui';

export interface DashboardThumbnailCardProps {
  uid: string;
  title: string;
  url?: string;
  thumbnailUrl?: string | null;
  folderName?: string;
  tags?: string[];
  lastVisited?: string;
  visitCount?: number;
  onClick?: () => void;
  showThumbnail?: boolean;
}

export const DashboardThumbnailCard = ({
  uid,
  title,
  thumbnailUrl,
  folderName,
  tags,
  lastVisited,
  visitCount,
  onClick,
  showThumbnail = true,
}: DashboardThumbnailCardProps) => {
  const styles = useStyles2(getStyles);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  return (
    <Card key={uid} className={styles.card} onClick={onClick}>
      <Stack direction="column" gap={0}>
        {/* Dashboard Thumbnail */}
        {showThumbnail && thumbnailUrl && (
          <div className={styles.thumbnailContainer}>
            <div className={styles.thumbnailWrapper}>
              {imageLoading && !imageError && (
                <div className={styles.thumbnailLoading}>
                  <Spinner />
                  <Text variant="bodySmall" color="secondary">
                    Rendering preview...
                  </Text>
                </div>
              )}
              {imageError && (
                <div className={styles.thumbnailError}>
                  <Icon name="apps" size="xxl" />
                  <Text variant="bodySmall" color="secondary">
                    {!config.rendererAvailable ? 'Image renderer not installed' : 'Preview unavailable'}
                  </Text>
                </div>
              )}
              <img
                src={thumbnailUrl}
                alt={title}
                className={styles.thumbnailImage}
                style={{ display: imageLoading || imageError ? 'none' : 'block' }}
                onLoad={() => {
                  setImageLoading(false);
                }}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className={styles.cardContent}>
          <Stack direction="row" gap={2} alignItems="center">
            <Text weight="medium" className={styles.title}>
              {title}
            </Text>
          </Stack>

          {/* Metadata Row */}
          <Stack direction="column" gap={1}>
            {folderName && (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder-open" size="sm" className={styles.metaIcon} />
                <Text variant="bodySmall" color="secondary">
                  {folderName}
                </Text>
              </Stack>
            )}

            {tags && tags.length > 0 && (
              <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
                <Icon name="tag-alt" size="sm" className={styles.metaIcon} />
                <Text variant="bodySmall" color="secondary">
                  {tags.slice(0, 3).join(', ')}
                </Text>
              </Stack>
            )}

            {lastVisited && (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="clock-nine" size="sm" className={styles.metaIcon} />
                <Text variant="bodySmall" color="secondary">
                  {new Date(lastVisited).toLocaleDateString()}
                </Text>
              </Stack>
            )}

            {visitCount !== undefined && visitCount > 0 && (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="eye" size="sm" className={styles.metaIcon} />
                <Text variant="bodySmall" color="secondary">
                  {visitCount} {visitCount === 1 ? 'view' : 'views'}
                </Text>
              </Stack>
            )}
          </Stack>
        </div>
      </Stack>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
    border: '2px solid transparent',

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: 1,
      pointerEvents: 'none',
    },

    '&:hover': {
      transform: 'translateY(-6px)',
      boxShadow: '0 12px 24px rgba(255, 120, 10, 0.15)',

      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  thumbnailContainer: css({
    margin: 0,
  }),

  thumbnailWrapper: css({
    position: 'relative',
    width: '100%',
    height: '180px',
    backgroundColor: theme.colors.background.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }),

  thumbnailLoading: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
  }),

  thumbnailError: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
    color: theme.colors.text.secondary,
  }),

  thumbnailImage: css({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }),

  cardContent: css({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),

  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  metaIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
});

