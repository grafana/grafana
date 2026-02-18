import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Box, Button, Card, IconButton, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { PluginDashboard } from 'app/types/plugins';

import { CompatibilityBadge, CompatibilityState } from './CompatibilityBadge';
import { GnetDashboard } from './types';

interface Details {
  id: string;
  datasource: string;
  dependencies: string[];
  publishedBy: string;
  lastUpdate: string;
  grafanaComUrl?: string;
}

interface Props {
  title: string;
  imageUrl?: string;
  dashboard: PluginDashboard | GnetDashboard;
  details?: Details;
  onClick: () => void;
  isLogo?: boolean; // Indicates if imageUrl is a small logo vs full screenshot
  showDatasourceProvidedBadge?: boolean;
  dimThumbnail?: boolean; // Apply 50% opacity to thumbnail when badge is shown
  kind: 'template_dashboard' | 'suggested_dashboard';
  /** Show the compact compatibility badge (replaces showCompatibilityButton) */
  showCompatibilityBadge?: boolean;
  /** State for the compatibility badge (idle, loading, success, error) */
  compatibilityState?: CompatibilityState;
  /** Handler called when Check button is clicked in the badge */
  onCompatibilityCheck?: () => void;
}

function DashboardCardComponent({
  title,
  imageUrl,
  onClick,
  dashboard,
  details,
  isLogo,
  showDatasourceProvidedBadge,
  dimThumbnail,
  kind,
  showCompatibilityBadge,
  compatibilityState,
  onCompatibilityCheck,
}: Props) {
  const styles = useStyles2(getStyles);
  const isCompatibilityAppEnabled = config.featureToggles.dashboardValidatorApp;

  const detailsButton = details && (
    <Tooltip interactive={true} content={<DetailsTooltipContent details={details} />} placement="right">
      <IconButton
        name="info-circle"
        size={isCompatibilityAppEnabled ? 'sm' : 'xl'}
        aria-label={t('dashboard-library.card.details-tooltip', 'Details')}
      />
    </Tooltip>
  );

  return (
    <Card className={styles.card} noMargin>
      <Card.Heading className={styles.title}>
        {isCompatibilityAppEnabled ? (
          <span className={styles.titleWithInfo}>
            <span className={styles.titleText}>{title}</span>
            {detailsButton}
          </span>
        ) : (
          title
        )}
      </Card.Heading>
      <div className={isLogo ? styles.logoContainer : styles.thumbnailContainer}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className={cx(
              isLogo ? styles.logo : styles.thumbnail,
              dimThumbnail && showDatasourceProvidedBadge && styles.dimmedImage,
              kind === 'suggested_dashboard' ? styles.thumbnailCoverImage : styles.thumbnailContainImage
            )}
            onError={(e) => {
              console.error('Failed to load image for:', title, 'URL:', imageUrl);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className={styles.noImage}>
            <Trans i18nKey="dashboard-library.card.no-preview">No preview available </Trans>
          </div>
        )}
        {showDatasourceProvidedBadge && (
          <div className={styles.badgeContainer}>
            <Badge
              text={t('dashboard-library.card.datasource-provided-badge', 'Data source provided')}
              color="orange"
            />
          </div>
        )}
      </div>
      <div title={dashboard.description || ''} className={styles.descriptionWrapper}>
        {dashboard.description && (
          <Card.Description data-testid="dashboard-card-description" className={styles.description}>
            {dashboard.description}
          </Card.Description>
        )}
      </div>
      <Card.Actions className={styles.actionsContainer}>
        <Button variant="secondary" onClick={onClick}>
          {kind === 'template_dashboard' ? (
            <Trans i18nKey="dashboard-library.card.use-template-button">Use template</Trans>
          ) : (
            <Trans i18nKey="dashboard-library.card.use-dashboard-button">Use dashboard</Trans>
          )}
        </Button>
        {!isCompatibilityAppEnabled && detailsButton}
        {isCompatibilityAppEnabled && showCompatibilityBadge && onCompatibilityCheck && (
          <CompatibilityBadge
            state={compatibilityState ?? { status: 'idle' }}
            onCheck={onCompatibilityCheck}
            onRetry={onCompatibilityCheck}
          />
        )}
      </Card.Actions>
    </Card>
  );
}

function DetailsTooltipContent({ details }: { details: Details }) {
  const Section = ({ label, value }: { label: string; value: string }) => {
    return (
      <Box display="flex" direction="column" gap={1}>
        <Text element="p">{label}</Text>
        <Text element="p" color="secondary">
          {value}
        </Text>
      </Box>
    );
  };

  return (
    <Box display="flex">
      <Box display="flex" direction="column" gap={1} width={{ xs: 'auto', md: 340 }}>
        <Section label={t('dashboard-library.dashboard-card.details.id', 'ID')} value={details.id} />
        <Section
          label={t('dashboard-library.dashboard-card.details.datasource', 'Datasource')}
          value={details.datasource}
        />
        <Section
          label={t('dashboard-library.dashboard-card.details.dependencies', 'Dependencies')}
          value={details.dependencies.join(' | ')}
        />
        <Section
          label={t('dashboard-library.dashboard-card.details.published-by', 'Published By')}
          value={details.publishedBy}
        />
        <Section
          label={t('dashboard-library.dashboard-card.details.last-update', 'Last Update')}
          value={details.lastUpdate}
        />
        {details.grafanaComUrl && (
          <Box display="flex" direction="column" gap={1}>
            <TextLink href={details.grafanaComUrl} external>
              {t('dashboard-library.dashboard-card.details.view-on-grafana-com', 'View on Grafana.com')}
            </TextLink>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      gridTemplateAreas: `
          "Heading Heading"
          "Thumbnail Thumbnail"
          "Description Description"
          "Actions Secondary"`,
      gridTemplateRows: 'auto auto auto auto',
      gridTemplateColumns: '1fr auto',
      height: 'auto',
      width: '350px',
      background: 'transparent',
      gridGap: theme.spacing(1),
      paddingLeft: 0,
      paddingRight: 0,
    }),
    thumbnailContainer: css({
      gridArea: 'Thumbnail',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.border.strong,
      borderWidth: 1,
      borderStyle: 'solid',
      width: '100%',
      maxWidth: '350px',
      height: '180px',
      backgroundColor: theme.colors.background.canvas,
      position: 'relative',
    }),
    thumbnail: css({
      width: '100%',
      height: '100%',
    }),
    thumbnailCoverImage: css({
      objectFit: 'cover',
    }),
    thumbnailContainImage: css({
      objectFit: 'contain',
    }),
    logoContainer: css({
      gridArea: 'Thumbnail',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      width: '100%',
      height: '180px',
      backgroundColor: theme.colors.background.secondary,
      position: 'relative',
    }),
    logo: css({
      objectFit: 'fill',
    }),
    noImage: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      height: '100%',
      width: '100%',
    }),
    descriptionWrapper: css({
      gridArea: 'Description',
      wordBreak: 'break-word',
      minHeight: `calc(${theme.typography.body.lineHeight} * 1em)`, // Preserve space even when empty
    }),
    title: css({
      display: '-webkit-box',
      WebkitLineClamp: 1,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    titleWithInfo: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      maxWidth: '100%',
    }),
    titleText: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flexShrink: 1,
      minWidth: 0,
    }),
    description: css({
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      margin: 0,
    }),
    actionsContainer: css({
      marginTop: 0,
      alignItems: 'center',
    }),
    detailsContainer: css({
      width: '340px',
    }),
    detailValue: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    badgeContainer: css({
      position: 'absolute',
      top: theme.spacing(1),
      right: theme.spacing(1),
      zIndex: 1,
    }),
    dimmedImage: css({
      opacity: 0.3,
    }),
    placeholderText: css({
      color: theme.colors.text.disabled,
      fontStyle: 'italic',
    }),
  };
}

const DashboardCardSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return <Skeleton width={350} height={300} containerClassName={styles.container} {...rootProps} />;
};

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

export const DashboardCard = attachSkeleton(DashboardCardComponent, DashboardCardSkeleton);
