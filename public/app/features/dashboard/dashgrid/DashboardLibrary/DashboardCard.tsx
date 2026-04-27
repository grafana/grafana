import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Box, Button, Card, IconButton, Text, TextLink, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { attachSkeleton, type SkeletonComponent } from '@grafana/ui/unstable';
import { type PluginDashboard } from 'app/types/plugins';

import { CompatibilityBadge, type CompatibilityState } from './CompatibilityBadge';
import { type GnetDashboard } from './types';
import { buildAssistantPrompt, buildTemplateContextData, buildTemplateContextTitle } from './utils/assistantHelpers';

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
  onClick: (customizeWithAssistant?: boolean) => void;
  onClose?: () => void;
  isLogo?: boolean; // Indicates if imageUrl is a small logo vs full screenshot
  showDatasourceProvidedBadge?: boolean;
  showCommunityBadge?: boolean;
  dimThumbnail?: boolean; // Apply 50% opacity to thumbnail when badge is shown
  kind: 'template_dashboard' | 'suggested_dashboard';
  /** Show the compact compatibility badge (replaces showCompatibilityButton) */
  showCompatibilityBadge?: boolean;
  /** State for the compatibility badge (idle, loading, success, error) */
  compatibilityState?: CompatibilityState;
  /** Handler called when Check button is clicked in the badge */
  onCompatibilityCheck?: () => void;
  /** Whether to show the "Customize with assistant" button (caller must check relevant feature flags) */
  showAssistantButton?: boolean;
}

function DashboardCardComponent({
  title,
  imageUrl,
  onClick,
  onClose,
  dashboard,
  details,
  isLogo,
  showDatasourceProvidedBadge,
  showCommunityBadge,
  dimThumbnail,
  kind,
  showCompatibilityBadge,
  compatibilityState,
  onCompatibilityCheck,
  showAssistantButton,
}: Props) {
  const styles = useStyles2(getStyles);
  const isCompatibilityAppEnabled = config.featureToggles.dashboardValidatorApp;

  const detailsButton = details && (
    <Tooltip interactive={true} content={<DetailsTooltipContent details={details} />} placement="right">
      <IconButton name="info-circle" size="md" aria-label={t('dashboard-library.card.details-tooltip', 'Details')} />
    </Tooltip>
  );

  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();

  // Create structured context item with template metadata for the Assistant
  const templateContext = useMemo(
    () =>
      createAssistantContextItem('structured', {
        hidden: false,
        title: buildTemplateContextTitle(dashboard, kind),
        data: buildTemplateContextData(dashboard, kind),
      }),
    [dashboard, kind]
  );

  const onUseAssistantClick = () => {
    if (assistantAvailable) {
      openAssistant?.({
        origin: 'dashboard-library/use-dashboard',
        mode: 'dashboarding',
        prompt: buildAssistantPrompt(kind),
        context: [templateContext],
        autoSend: true,
      });
      // these both closes the modal and redirects the user the the template dashboard url
      onClose?.();
      onClick?.(true);
    }
  };

  const hasCompatActions = isCompatibilityAppEnabled && showCompatibilityBadge && onCompatibilityCheck;

  return (
    <Card className={styles.card} noMargin>
      <Card.Heading className={styles.title}>
        <span className={styles.titleWithInfo} role="group" aria-label={title}>
          <span className={styles.titleText}>{title}</span>
          {detailsButton}
        </span>
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
        {showCommunityBadge && (
          <div className={styles.badgeContainer}>
            <Badge text={t('dashboard-library.card.community-badge', 'Community')} color="blue" />
          </div>
        )}
        <div className={styles.thumbnailOverlay}>
          <Button
            variant="secondary"
            className={styles.overlayButton}
            onClick={() => onClick()}
            aria-label={
              kind === 'template_dashboard'
                ? t('dashboard-library.card.view-template-button-label', 'View template: {{title}}', { title })
                : t('dashboard-library.card.view-dashboard-button-label', 'View dashboard: {{title}}', { title })
            }
          >
            {kind === 'template_dashboard' ? (
              <Trans i18nKey="dashboard-library.card.view-template-button">View template</Trans>
            ) : (
              <Trans i18nKey="dashboard-library.card.view-dashboard-button">View dashboard</Trans>
            )}
          </Button>
          {assistantAvailable && showAssistantButton && (
            <Button
              variant="secondary"
              className={styles.overlayButton}
              onClick={onUseAssistantClick}
              icon="ai-sparkle"
              aria-label={t(
                'dashboard-library.card.customize-with-assistant-button-label',
                'Customize with Assistant: {{title}}',
                { title }
              )}
            >
              <Trans i18nKey="dashboard-library.card.customize-with-assistant-button">Customize with Assistant</Trans>
            </Button>
          )}
        </div>
      </div>
      <div className={styles.bottomSection}>
        <div title={dashboard.description}>
          <Card.Description
            data-testid="dashboard-card-description"
            className={cx(styles.description, { [styles.noDescription]: !dashboard.description })}
          >
            {dashboard.description || t('dashboard-library.dashboard-card.no-description', 'No description available')}
          </Card.Description>
        </div>
        {hasCompatActions && (
          <div className={styles.actionsContainer}>
            {isCompatibilityAppEnabled && showCompatibilityBadge && onCompatibilityCheck && (
              <CompatibilityBadge
                state={compatibilityState ?? { status: 'idle' }}
                onCheck={onCompatibilityCheck}
                onRetry={onCompatibilityCheck}
              />
            )}
          </div>
        )}
      </div>
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
  const thumbnailOverlay = css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    opacity: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 0.15s ease',
    },
  });

  return {
    card: css({
      gridTemplateAreas: `
          "Thumbnail Thumbnail"
          "Heading Heading"
          "Bottom Bottom"`,
      gridTemplateRows: 'auto auto 1fr',
      gridTemplateColumns: '1fr auto',
      width: '350px',
      height: '100%',
      background: 'transparent',
      border: `1px solid ${theme.colors.border.strong}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      gridGap: 0,
      padding: theme.spacing(1),
    }),
    thumbnailContainer: css({
      gridArea: 'Thumbnail',
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      width: '100%',
      aspectRatio: '16/9',
      backgroundColor: theme.colors.background.canvas,
      position: 'relative',
      [`&:hover .${thumbnailOverlay}, &:focus-within .${thumbnailOverlay}`]: {
        opacity: 1,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'linear-gradient(to bottom, rgba(6, 6, 6, 0) 50%, #060606 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      },
    }),
    thumbnailOverlay,
    overlayButton: css({
      width: '80%',
      justifyContent: 'center',
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
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      width: '100%',
      aspectRatio: '16/9',
      backgroundColor: theme.colors.background.secondary,
      position: 'relative',
      [`&:hover .${thumbnailOverlay}, &:focus-within .${thumbnailOverlay}`]: {
        opacity: 1,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        background: 'linear-gradient(to bottom, rgba(6, 6, 6, 0) 26%, #060606 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      },
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
    bottomSection: css({
      gridArea: 'Bottom',
      display: 'flex',
      flexDirection: 'column',
      wordBreak: 'break-word',
      paddingTop: '2px',
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
      WebkitLineClamp: 1,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      margin: 0,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    noDescription: css({
      fontStyle: 'italic',
    }),
    actionsContainer: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'nowrap',
      marginTop: 'auto',
      paddingTop: theme.spacing(1),
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
      bottom: theme.spacing(1),
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

interface DashboardCardSkeletonProps {
  showCompatibilityBadge?: boolean;
}

const DashboardCardSkeleton: SkeletonComponent<DashboardCardSkeletonProps> = ({
  rootProps,
  showCompatibilityBadge,
}) => {
  const styles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.card} style={rootProps.style}>
      <Skeleton containerClassName={styles.thumbnail} height="100%" />
      <Skeleton height={22} width="70%" />
      <Skeleton height={19} width="90%" />
      {showCompatibilityBadge && <Skeleton height={33} width={100} />}
    </div>
  );
};

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  card: css({
    width: '350px',
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    lineHeight: 1,
  }),
  thumbnail: css({
    display: 'block',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    lineHeight: 1,
  }),
});

export const DashboardCard = attachSkeleton(DashboardCardComponent, DashboardCardSkeleton);
