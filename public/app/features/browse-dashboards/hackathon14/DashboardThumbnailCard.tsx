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

  const getTagColor = (tag: string) => {
    const palette = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#22d3ee', '#f97316', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  const fallbackMessage = !config.rendererAvailable ? 'Renderer not available' : 'Preview unavailable';

  return (
    <Card key={uid} className={styles.card} onClick={onClick} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
      <Stack direction="column" gap={0} className={styles.cardBody}>
        {/* Dashboard Thumbnail */}
        {showThumbnail && (
          <div className={styles.thumbnailContainer}>
            <div className={styles.thumbnailWrapper}>
              {thumbnailUrl && !imageError ? (
                <>
                  {imageLoading && (
                    <div className={styles.thumbnailLoading}>
                      <Spinner />
                      <Text variant="bodySmall" color="secondary">
                        Rendering preview...
                      </Text>
                    </div>
                  )}
                  <img
                    src={thumbnailUrl}
                    alt={title}
                    className={styles.thumbnailImage}
                    style={{ display: imageLoading ? 'none' : 'block' }}
                    onLoad={() => {
                      setImageLoading(false);
                    }}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                  />
                </>
              ) : (
                <div className={styles.thumbnailFallback}>
                  <Icon name="apps" size="xl" />
                  <Text variant="bodySmall" color="secondary">
                    {fallbackMessage}
                  </Text>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className={styles.cardContent}>
          <Stack direction="row" gap={2} alignItems="center">
            <Text weight="medium" truncate>
              {title}
            </Text>
          </Stack>

          {/* Metadata Row */}
          <Stack direction="column" gap={1.5}>
            {folderName && (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder-open" size="sm" className={styles.metaIcon} />
                <Text variant="bodySmall" color="secondary">
                  {folderName}
                </Text>
              </Stack>
            )}

            {tags && tags.length > 0 && (
              <Stack direction="row" gap={0.5} alignItems="center" className={styles.tagRow}>
                <Icon name="tag-alt" size="sm" className={styles.metaIcon} style={{ marginRight: '4px' }} />
                <Stack direction="row" gap={0.5} className={styles.tagChipRow}>
                  {tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className={styles.tagChip}
                      style={{ backgroundColor: `${getTagColor(tag)}22`, color: getTagColor(tag) }}
                    >
                      {tag}
                    </span>
                  ))}
                  {tags.length > 2 && <span className={styles.tagChipMuted}>+{tags.length - 2}</span>}
                </Stack>
              </Stack>
            )}

            <Stack direction="row" gap={1} alignItems="center" className={styles.metaRow}>
              <Icon name="clock-nine" size="sm" className={styles.metaIcon} style={{ marginRight: '4px' }} />
              <Text variant="bodySmall" color="secondary">
                {lastVisited ? new Date(lastVisited).toLocaleDateString() : 'Never visited'}
              </Text>
            </Stack>

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
    minHeight: '340px',

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

  cardBody: css({
    minHeight: '100%',
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

  thumbnailFallback: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    height: '100%',
    color: theme.colors.text.secondary,
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(236, 72, 153, 0.15))',
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

  tagChip: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightMedium,
  }),

  tagChipMuted: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0.25, 0.6),
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightMedium,
    background: 'rgba(148, 163, 184, 0.2)',
    color: theme.colors.text.secondary,
  }),
  tagRow: css({
    gap: theme.spacing(0.5),
    minHeight: theme.spacing(3),
  }),
  tagChipRow: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
    flexWrap: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  metaRow: css({
    gap: theme.spacing(0.5),
  }),
});
