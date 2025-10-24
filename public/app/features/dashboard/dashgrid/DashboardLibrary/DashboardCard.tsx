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
}

export function DashboardCard({ title, imageUrl, onClick, onDetailsClick, dashboard, details }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Card className={styles.card} noMargin>
      <Card.Heading className={styles.title}>{title}</Card.Heading>
      <div className={styles.thumbnailContainer}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className={styles.thumbnail}
            // style={{ display: thumbnailUrl ? 'block' : 'none' }}
          />
        ) : null}
      </div>
      <div title={dashboard.description || ''} className={styles.descriptionWrapper}>
        {dashboard.description && (
          <Card.Description className={styles.description}>{dashboard.description}</Card.Description>
        )}
      </div>
      <Card.Actions className={styles.actionsContainer}>
        <Button variant="secondary" onClick={onClick}>
          <Trans i18nKey="dashboard.template.use-template-button">Use template</Trans>
        </Button>
        {details && (
          <Toggletip
            title={t('dashboard.template.details-title', 'Details')}
            content={<DetailsToggletipContent details={details} />}
            closeButton={true}
            placement="right"
          >
            <Button variant="secondary" fill="outline" onClick={onDetailsClick}>
              <Trans i18nKey="dashboard.template.use-template-button">Details</Trans>
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
        <Section label="ID" value={details.id} />
        <Section label="Datasource" value={details.datasource} />
        <Section label="Dependencies" value={details.dependencies.join(' | ')} />
        <Section label="Published By" value={details.publishedBy} />
        <Section label="Last Update" value={details.lastUpdate} />
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
      //   borderRadius: theme.shape.radius.default,
      //   backgroundColor: theme.colors.background.secondary,
      //   marginTop: theme.spacing(1),
      //   marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.border.strong,
      borderWidth: 1,
      borderStyle: 'solid',
      width: '350px',
      //   height: '200px',
    }),
    thumbnail: css({
      width: '100%',
      objectFit: 'contain',
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
