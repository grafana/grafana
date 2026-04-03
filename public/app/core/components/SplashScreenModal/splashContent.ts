import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import assistantHeroImage from './images/assistant-hero.png';
import gitSyncImage from './images/git-sync.png';
import libraryOfThingsImage from './images/library-of-things.png';

export type AccentColorKey = 'dark-purple' | 'primary' | 'success' | 'dark-orange';

export interface SplashFeature {
  id: string;
  icon: IconName;
  badgeText: string;
  badgeIcon?: IconName;
  accentColor: AccentColorKey;
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
        badgeText: t('splash-screen.assistant.badge', 'NEW'),
        accentColor: 'dark-purple',
        title: t('splash-screen.assistant.title', 'Grafana Assistant is now available to OSS users'),
        subtitle: t('splash-screen.assistant.subtitle', 'Use AI to handle everything from config to query generation'),
        bullets: [
          t('splash-screen.assistant.bullet-1', 'Explore your data by prompting Assistant to generate queries for you'),
          t('splash-screen.assistant.bullet-2', 'Create comprehensive dashboards in minutes'),
          t('splash-screen.assistant.bullet-3', 'Onboard new team members in days, not weeks'),
        ],
        ctaText: t('splash-screen.assistant.cta', 'Show me'),
        ctaUrl: '/a/grafana-assistant-app',
        heroImageUrl: assistantHeroImage,
      },
      {
        id: 'dynamic-dashboards',
        icon: 'apps',
        badgeText: t('splash-screen.badge.new', 'NEW IN G13'),
        accentColor: 'primary',
        title: t('splash-screen.dynamic-dashboards.title', 'Add tabs and panel conditions to your dashboards'),
        subtitle: t(
          'splash-screen.dynamic-dashboards.subtitle',
          'Make your dashboards more impactful and easier to explore'
        ),
        bullets: [
          t('splash-screen.dynamic-dashboards.bullet-1', 'Split content into tabs for quick switching'),
          t(
            'splash-screen.dynamic-dashboards.bullet-2',
            'Show or hide panels based on template variables and other conditions'
          ),
          t('splash-screen.dynamic-dashboards.bullet-3', 'Auto-arrange panels into a grid for an efficient layout'),
        ],
        ctaText: t('splash-screen.dynamic-dashboards.cta', 'Show me'),
        ctaUrl: '/dashboards',
        heroImageUrl: assistantHeroImage,
      },
      {
        id: 'git-sync',
        icon: 'code-branch',
        badgeText: t('splash-screen.badge.new', 'NEW IN G13'),
        accentColor: 'success',
        title: t('splash-screen.git-sync.title', 'Sync your dashboards to Git'),
        subtitle: t(
          'splash-screen.git-sync.subtitle',
          'Bring version control, collaboration, and reliability to your dashboards'
        ),
        bullets: [
          t('splash-screen.git-sync.bullet-1', 'Store your dashboard configuration safely in any git repository'),
          t('splash-screen.git-sync.bullet-2', 'keep track of the changes - and who made them'),
          t(
            'splash-screen.git-sync.bullet-3',
            'Works with many deployment scenarios like dev-prod, HA, and instances shared by multiple teams'
          ),
        ],
        ctaText: t('splash-screen.git-sync.cta', 'Show me'),
        ctaUrl: '/admin/provisioning',
        heroImageUrl: gitSyncImage,
      },
      {
        id: 'library-of-things',
        icon: 'compass',
        badgeText: t('splash-screen.badge.new', 'NEW IN G13'),
        accentColor: 'dark-orange',
        title: t('splash-screen.library-of-things.title', 'Kickstart dashboards with suggestions and templates'),
        subtitle: t(
          'splash-screen.library-of-things.subtitle',
          'Get to a useful dashboard sooner by starting from a proven design'
        ),
        bullets: [
          t('splash-screen.library-of-things.bullet-1', 'Start from a clean layout instead of building from scratch'),
          t('splash-screen.library-of-things.bullet-2', 'Load a template and customize it to your needs'),
          t(
            'splash-screen.library-of-things.bullet-3',
            'Explore and use community dashboards tailored to your data source'
          ),
        ],
        ctaText: t('splash-screen.library-of-things.cta', 'Show me'),
        ctaUrl: '/explore',
        heroImageUrl: libraryOfThingsImage,
      },
    ],
  };
}
