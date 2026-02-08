import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Box, Button, Card, IconButton, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { PluginDashboard } from 'app/types/plugins';

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
  onClick: () => void;
  onClose?: () => void;
  onTrackAssistantButton?: () => void; // Called before opening assistant, for analytics tracking
  isLogo?: boolean; // Indicates if imageUrl is a small logo vs full screenshot
  showDatasourceProvidedBadge?: boolean;
  dimThumbnail?: boolean; // Apply 50% opacity to thumbnail when badge is shown
  kind: 'template_dashboard' | 'suggested_dashboard';
  showAssistantButton?: boolean;
}

function DashboardCardComponent({
  title,
  imageUrl,
  onClick,
  onClose,
  onTrackAssistantButton,
  dashboard,
  details,
  isLogo,
  showDatasourceProvidedBadge,
  dimThumbnail,
  kind,
  showAssistantButton,
}: Props) {
  const styles = useStyles2(getStyles);

  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();

  // Create structured context item with template metadata for the Assistant
  const templateContext = useMemo(
    () =>
      createAssistantContextItem('structured', {
        title: buildTemplateContextTitle(dashboard, title),
        data: buildTemplateContextData(dashboard, title, kind),
      }),
    [dashboard, title, kind]
  );

  // Build the enhanced prompt with template details
  const assistantPrompt = useMemo(() => buildAssistantPrompt(dashboard, title, kind), [dashboard, title, kind]);

  const onUseAssistantClick = () => {
    if (assistantAvailable) {
      onTrackAssistantButton?.();

      openAssistant?.({
        origin: 'dashboard-library/use-dashboard',
        // @ts-expect-error - 'dashboarding' mode is valid but not in current type definitions
        // TODO: Is there a better way to do this?
        mode: 'dashboarding',
        prompt: assistantPrompt,
        context: [templateContext],
        autoSend: true,
      });
      onClose?.();
    }
  };

  return (
    <Card className={styles.card} noMargin>
      <Card.Heading className={styles.title}>{title}</Card.Heading>
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
            <Trans i18nKey="dashboard-library.card.view-template-button">View template</Trans>
          ) : (
            <Trans i18nKey="dashboard-library.card.use-dashboard-button">Use dashboard</Trans>
          )}
        </Button>
        {assistantAvailable && showAssistantButton && (
          <Button variant="secondary" fill="text" onClick={onUseAssistantClick} icon="ai-sparkle">
            <Trans i18nKey="dashboard-library.card.customize-with-assistant-button">Customize with Assistant</Trans>
          </Button>
        )}
        {details && (
          <Tooltip interactive={true} content={<DetailsTooltipContent details={details} />} placement="right">
            <IconButton
              name="info-circle"
              size="xl"
              aria-label={t('dashboard-library.card.details-tooltip', 'Details')}
            />
          </Tooltip>
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
      alignItems: 'stretch',
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
