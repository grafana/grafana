import { css } from '@emotion/css';

import { locationUtil, type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useAppPluginMeta } from '@grafana/runtime/internal';
import { Badge, Card, Grid, Icon, useStyles2, useTheme2 } from '@grafana/ui';
import awsDarkSvg from 'img/cloud-providers/aws-dark.svg';
import awsLightSvg from 'img/cloud-providers/aws-light.svg';
import azureSvg from 'img/cloud-providers/azure.svg';

export const DS_ONBOARDING_PLUGIN_ID = 'grafana-dsonboarding-app';

interface CloudProvider {
  id: string;
  // Brand logo when we have one; otherwise falls back to a generic icon.
  logo?: { light: string; dark: string };
  icon?: IconName;
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
      logo: { light: awsLightSvg, dark: awsDarkSvg },
      name: t('connections.cloud-provider-cards.aws.name', 'AWS Onboarding'),
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
      logo: { light: azureSvg, dark: azureSvg },
      name: t('connections.cloud-provider-cards.azure.name', 'Azure Onboarding'),
      description: t(
        'connections.cloud-provider-cards.azure.description',
        'Azure Monitor, Data Explorer, and managed Prometheus'
      ),
      url: `/a/${DS_ONBOARDING_PLUGIN_ID}/azure/services`,
      keywords: ['azure', 'microsoft', 'monitor', 'data explorer', 'prometheus', 'cloud', 'onboard'],
    },
    {
      id: 'gcp',
      icon: 'google',
      name: t('connections.cloud-provider-cards.gcp.name', 'Google Cloud Onboarding'),
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
  logoImage: css({
    width: theme.spacing(3.5),
    height: theme.spacing(3.5),
    objectFit: 'contain',
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
  const theme = useTheme2();
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
                {provider.logo ? (
                  <img
                    className={styles.logoImage}
                    src={theme.isDark ? provider.logo.dark : provider.logo.light}
                    alt=""
                  />
                ) : (
                  provider.icon && <Icon name={provider.icon} size="xl" />
                )}
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
