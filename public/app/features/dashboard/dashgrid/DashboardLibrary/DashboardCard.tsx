import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Box, Button, Card, IconButton, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { PluginDashboard } from 'app/types/plugins';

import { CompatibilityBadge, CompatibilityState } from './CompatibilityBadge';
import { GnetDashboard } from './types';
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
  dimThumbnail?: boolean; // Apply 50% opacity to thumbnail when badge is shown
  kind: 'template_dashboard' | 'suggested_dashboard';
  /** Show the compact compatibility badge (replaces showCompatibilityButton) */
  showCompatibilityBadge?: boolean;
  /** State for the compatibility badge (idle, loading, success, error) */
  compatibilityState?: CompatibilityState;
  /** Handler called when Check button is clicked in the badge */
  onCompatibilityCheck?: () => void;
  /** Dashboard author name shown below the title */
  author?: string;
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
  dimThumbnail,
  kind,
  showCompatibilityBadge,
  compatibilityState,
  onCompatibilityCheck,
  author,
  showAssistantButton,
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

  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();

  // Create structured context item with template metadata for the Assistant
  const templateContext = useMemo(
    () =>
      createAssistantContextItem('structured', {
        hidden: false,
        title: buildTemplateContextTitle(dashboard),
        data: buildTemplateContextData(dashboard, kind),
      }),
    [dashboard, kind]
  );

  const onUseAssistantClick = () => {
    if (assistantAvailable) {
      openAssistant?.({
        origin: 'dashboard-library/use-dashboard',
        mode: 'dashboarding',
        prompt: buildAssistantPrompt(),
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
                'Customize with assistant: {{title}}',
                { title }
              )}
            >
              <Trans i18nKey="dashboard-library.card.customize-with-assistant-button">Customize with assistant</Trans>
            </Button>
          )}
        </div>
      </div>
      {author && (
        <div className={styles.metaRow}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="dashboard-library.card.author">Author: </Trans>
            {author}
          </Text>
        </div>
      )}
      {(dashboard.description || hasCompatActions) && (
        <div className={styles.bottomSection}>
          {dashboard.description && (
            <div title={dashboard.description}>
              <Card.Description data-testid="dashboard-card-description" className={styles.description}>
                {dashboard.description}
              </Card.Description>
            </div>
          )}
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
      )}
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
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 0.15s ease',
    },
    borderRadius: theme.shape.radius.default,
  });

  return {
    card: css({
      gridTemplateAreas: `
          "Thumbnail Thumbnail"
          "Heading Heading"
          "Meta Meta"
          "Bottom Bottom"`,
      gridTemplateRows: 'auto auto auto auto',
      gridTemplateColumns: '1fr auto',
      height: 'auto',
      width: '350px',
      background: 'transparent',
      gridGap: theme.spacing(1),
      paddingLeft: 0,
      paddingRight: 0,
      alignSelf: 'start',
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
      [`&:hover .${thumbnailOverlay}, &:focus-within .${thumbnailOverlay}`]: {
        opacity: 1,
      },
    }),
    thumbnailOverlay,
    overlayButton: css({
      width: '80%',
      justifyContent: 'center',
    }),
    metaRow: css({
      gridArea: 'Meta',
      display: 'flex',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
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
      [`&:hover .${thumbnailOverlay}, &:focus-within .${thumbnailOverlay}`]: {
        opacity: 1,
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
      gap: theme.spacing(1),
      wordBreak: 'break-word',
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
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'nowrap',
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
