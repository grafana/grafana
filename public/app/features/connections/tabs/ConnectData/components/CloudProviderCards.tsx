import { css } from '@emotion/css';

import { locationUtil, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useAppPluginMeta } from '@grafana/runtime/internal';
import { Badge, Card, Grid, useStyles2 } from '@grafana/ui';

export const DS_ONBOARDING_PLUGIN_ID = 'grafana-dsonboarding-app';

interface CloudProvider {
  id: string;
  logoText: string;
  name: string;
  description: string;
  url?: string;
  // Extra non-translated terms the search box should match, e.g. product names.
  keywords: string[];
}

function getProviders(): CloudProvider[] {
  return [
    {
      id: 'aws',
      logoText: 'aws',
      name: t('connections.cloud-provider-cards.aws.name', 'AWS data sources'),
      description: t('connections.cloud-provider-cards.aws.description', 'CloudWatch, Athena, Redshift, and 7 more'),
      url: `/a/${DS_ONBOARDING_PLUGIN_ID}/aws`,
      keywords: [
        'aws',
        'amazon',
        'cloudwatch',
        'athena',
        'redshift',
        'prometheus',
        'x-ray',
        'timestream',
        'cloud',
        'onboard',
      ],
    },
    {
      id: 'azure',
      logoText: 'Az',
      name: t('connections.cloud-provider-cards.azure.name', 'Azure data sources'),
      description: t(
        'connections.cloud-provider-cards.azure.description',
        'Azure Monitor, Data Explorer, and managed Prometheus'
      ),
      url: `/a/${DS_ONBOARDING_PLUGIN_ID}/azure/services`,
      keywords: ['azure', 'microsoft', 'monitor', 'data explorer', 'prometheus', 'cloud', 'onboard'],
    },
    {
      id: 'gcp',
      logoText: 'GC',
      name: t('connections.cloud-provider-cards.gcp.name', 'Google Cloud data sources'),
      description: t('connections.cloud-provider-cards.gcp.description', 'BigQuery, Cloud Monitoring, and more'),
      keywords: ['gcp', 'google', 'google cloud', 'bigquery', 'cloud monitoring', 'stackdriver', 'cloud', 'onboard'],
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(5),
    height: theme.spacing(5),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightBold,
  }),
  heading: css({
    fontSize: theme.typography.h5.fontSize,
  }),
  description: css({
    margin: 0,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  disabled: css({
    opacity: 0.6,
  }),
});

function matchesSearch(provider: CloudProvider, searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return true;
  }
  return [provider.name, provider.description, provider.id, ...provider.keywords].some((value) =>
    value.toLowerCase().includes(term)
  );
}

/**
 * Whether the cloud tiles should render for this search: the onboarding app is installed
 * (checked independently of the search results) and at least one tile matches.
 */
export function useShowCloudProviderCards(searchTerm: string): boolean {
  const { value: onboardingApp } = useAppPluginMeta(DS_ONBOARDING_PLUGIN_ID);
  return Boolean(onboardingApp) && getProviders().some((provider) => matchesSearch(provider, searchTerm));
}

export function CloudProviderCards({ searchTerm = '' }: { searchTerm?: string }) {
  const styles = useStyles2(getStyles);
  const providers = getProviders().filter((provider) => matchesSearch(provider, searchTerm));

  if (providers.length === 0) {
    return null;
  }

  return (
    <Grid gap={1.5} minColumnWidth={44}>
      {providers.map((provider) => {
        const comingSoon = !provider.url;
        return (
          <Card
            key={provider.id}
            noMargin
            href={provider.url ? locationUtil.assureBaseUrl(provider.url) : undefined}
            className={comingSoon ? styles.disabled : undefined}
            data-testid={`cloud-provider-card-${provider.id}`}
          >
            <Card.Heading className={styles.heading}>{provider.name}</Card.Heading>
            <Card.Figure>
              <div className={styles.logo} aria-hidden>
                {provider.logoText}
              </div>
            </Card.Figure>
            <Card.Description className={styles.description}>{provider.description}</Card.Description>
            {comingSoon && (
              <Card.Meta>
                <Badge text={t('connections.cloud-provider-cards.coming-soon', 'Coming soon')} color="orange" />
              </Card.Meta>
            )}
          </Card>
        );
      })}
    </Grid>
  );
}
