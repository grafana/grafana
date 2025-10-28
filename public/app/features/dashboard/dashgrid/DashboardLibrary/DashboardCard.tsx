import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Button, Card, Text, Toggletip, useStyles2 } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard } from './types';

interface Details {
  id: string;
  datasource: string;
  dependencies: string[];
  publishedBy: string;
  lastUpdate: string;
}

interface Props {
  title: string;
  imageUrl?: string;
  dashboard: PluginDashboard | GnetDashboard;
  details?: Details;
  onClick: () => void;
  onDetailsClick?: () => void;
  isLogo?: boolean; // Indicates if imageUrl is a small logo vs full screenshot
}

export function DashboardCard({ title, imageUrl, onClick, onDetailsClick, dashboard, details, isLogo }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Card className={styles.card} noMargin>
      <Card.Heading className={styles.title}>{title}</Card.Heading>
      <div className={isLogo ? styles.logoContainer : styles.thumbnailContainer}>
        {imageUrl && imageUrl.trim() ? (
          <img
            src={imageUrl}
            alt={title}
            className={isLogo ? styles.logo : styles.thumbnail}
            onError={(e) => {
              console.error('Failed to load image for:', title, 'URL:', imageUrl);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className={styles.noImage}>
            <Trans i18nKey="dashboard-template.card.no-preview">No preview available </Trans>
          </div>
        )}
      </div>
      <div title={dashboard.description || ''} className={styles.descriptionWrapper}>
        {dashboard.description && (
          <Card.Description className={styles.description}>{dashboard.description}</Card.Description>
        )}
      </div>
      <Card.Actions className={styles.actionsContainer}>
        <Button variant="secondary" onClick={onClick}>
          <Trans i18nKey="dashboard-template.card.use-template-button">Use template</Trans>
        </Button>
        {details && (
          <Toggletip
            title={t('dashboard-template.card.details-title', 'Details')}
            content={<DetailsToggletipContent details={details} />}
            closeButton={true}
            placement="right"
          >
            <Button variant="secondary" fill="outline" onClick={onDetailsClick}>
              <Trans i18nKey="dashboard-template.card.details-button">Details</Trans>
            </Button>
          </Toggletip>
        )}
      </Card.Actions>
    </Card>
  );
}

function DetailsToggletipContent({ details }: { details: Details }) {
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
      </Box>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      gridTemplateAreas: `
          "Heading"
          "Thumbnail"
          "Description"
          "Actions"`,
      gridTemplateRows: 'auto auto auto auto',
      height: 'auto',
      width: '350px',
      background: 'transparent',
      gridGap: theme.spacing(1),
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
      width: '350px',
      height: '180px',
      backgroundColor: theme.colors.background.canvas,
    }),
    thumbnail: css({
      width: '350px',
      height: '100%',
      objectFit: 'cover',
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
      cursor: 'help',
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
    }),
    detailsContainer: css({
      width: '340px',
    }),
    detailValue: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
  };
}
