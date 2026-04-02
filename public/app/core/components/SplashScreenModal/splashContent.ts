import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import assistantHeroImage from './images/assistant-hero.png';
import gitSyncImage from './images/git-sync.png';
import libraryOfThingsImage from './images/library-of-things.png';

export interface SplashFeature {
  id: string;
  icon: IconName;
  badge: { text: string; icon?: IconName };
  accentColor: (theme: GrafanaTheme2) => string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaText: string;
  ctaUrl: string;
  heroImageUrl: string;
}

export interface SplashScreenConfig {
  version: string;
  features: SplashFeature[];
}

export function getSplashScreenConfig(): SplashScreenConfig {
  return {
    version: '13.0.0',
    features: [
      {
        id: 'assistant',
        icon: 'ai-sparkle',
        badge: { text: t('splash-screen.assistant.badge', 'NOW IN OSS') },
        accentColor: (theme) => theme.visualization.getColorByName('dark-purple'),
        title: t('splash-screen.assistant.title', 'Use Grafana Assistant in Grafana OSS'),
        subtitle: t('splash-screen.assistant.subtitle', 'Use AI to handle everything from config to query generation'),
        bullets: [
          t('splash-screen.assistant.bullet-1', 'Build complex dashboards in minutes'),
          t('splash-screen.assistant.bullet-2', 'Correlate metrics, logs and traces and gain insights in minutes'),
          t('splash-screen.assistant.bullet-3', 'Onboard new team members in a week instead of a month'),
        ],
        ctaText: t('splash-screen.assistant.cta', 'Show me'),
        ctaUrl: '/a/grafana-assistant-app',
        heroImageUrl: assistantHeroImage,
      },
      {
        id: 'dynamic-dashboards',
        icon: 'apps',
        badge: { text: t('splash-screen.dynamic-dashboards.badge', 'NEW IN G13') },
        accentColor: (theme) => theme.colors.primary.text,
        title: t('splash-screen.dynamic-dashboards.title', 'Make your dashboards more dynamic'),
        subtitle: t('splash-screen.dynamic-dashboards.subtitle', 'Make your dashboards more impactful by making them more interactive'),
        bullets: [
          t('splash-screen.dynamic-dashboards.bullet-1', 'Split content into tabs for quick switching'),
          t('splash-screen.dynamic-dashboards.bullet-2', 'Show or hide panels based on template variables and other conditions'),
          t('splash-screen.dynamic-dashboards.bullet-3', 'Auto-arrange panels for an efficient layout'),
        ],
        ctaText: t('splash-screen.dynamic-dashboards.cta', 'Show me'),
        ctaUrl: '/dashboards',
        heroImageUrl: assistantHeroImage,
      },
      {
        id: 'git-sync',
        icon: 'code-branch',
        badge: { text: t('splash-screen.git-sync.badge', 'NEW IN G13') },
        accentColor: (theme) => theme.colors.success.text,
        title: t('splash-screen.git-sync.title','Sync your dashboards to Git'),
        subtitle: t('splash-screen.git-sync.subtitle', 'Bring version control, collaboration, and reliability to your dashboards'),
        bullets: [
          t('splash-screen.git-sync.bullet-1', 'Store your dashboard configuration safely in any git repository'),
          t('splash-screen.git-sync.bullet-2', 'Keep track of the changes - and who made them!'),
          t('splash-screen.git-sync.bullet-3', 'Works with many deployment scenarios'),
        ],
        ctaText: t('splash-screen.git-sync.cta', 'Show me'),
        ctaUrl: '/admin/provisioning',
        heroImageUrl: gitSyncImage,
      },
      {
        id: 'library-of-things',
        icon: 'compass',
        badge: { text: t('splash-screen.library-of-things.badge', 'NEW IN G13') },
        accentColor: (theme) => theme.visualization.getColorByName('dark-orange'),
        title: t('splash-screen.library-of-things.title', 'Dashboard suggestions and templates'),
        subtitle: t(
          'splash-screen.library-of-things.subtitle', 'Use dashboard suggestions, templates, and saved queries get to a useful dashboard sooner'),
        bullets: [
          t('splash-screen.library-of-things.bullet-1', 'Start with a community dashboard tailored to your data source'),
          t('splash-screen.library-of-things.bullet-2', 'Start with a template and customize it to your needs'),
          t('splash-screen.library-of-things.bullet-3', 'Start from proven designs instead of building from scratch'),
        ],
        ctaText: t('splash-screen.library-of-things.cta', 'Show me'),
        ctaUrl: '/explore',
        heroImageUrl: libraryOfThingsImage,
      },
    ],
  };
}
