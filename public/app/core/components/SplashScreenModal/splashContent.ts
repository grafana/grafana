import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

export interface SplashFeature {
  id: string;
  icon: IconName;
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
        icon: 'comment-alt-message',
        title: t('splash-screen.assistant.title', 'Grafana Assistant is now available in OSS'),
        subtitle: t(
          'splash-screen.assistant.subtitle',
          'Say no to lengthy config work and troubleshooting. Use the Assistant to be faster than ever.'
        ),
        bullets: [
          t('splash-screen.assistant.bullet-1', 'Build complex dashboards in minutes'),
          t('splash-screen.assistant.bullet-2', 'Correlate metrics, logs and traces and gain insights in minutes'),
          t('splash-screen.assistant.bullet-3', 'Onboard new team members in a week instead of a month'),
        ],
        ctaText: t('splash-screen.assistant.cta', 'Show me'),
        ctaUrl: '/a/grafana-assistant-app',
        heroImageUrl: 'https://placehold.co/600x700/2A1F4E/8B5CF6?text=Assistant',
      },
      {
        id: 'git-sync',
        icon: 'code-branch',
        title: t(
          'splash-screen.git-sync.title',
          'Connect Grafana to your preferred git repository and keep them always in sync'
        ),
        subtitle: t(
          'splash-screen.git-sync.subtitle',
          'Combine the benefit of managing dashboards as code with the simplicity of creating and editing them in Grafana UI.'
        ),
        bullets: [
          t('splash-screen.git-sync.bullet-1', 'Store your dashboard configuration safely in any git repository'),
          t('splash-screen.git-sync.bullet-2', 'Keep track of the changes — and who made them!'),
          t('splash-screen.git-sync.bullet-3', 'Works with many deployment scenarios'),
        ],
        ctaText: t('splash-screen.git-sync.cta', 'Show me'),
        ctaUrl: '/admin/provisioning',
        heroImageUrl: 'https://placehold.co/500x600/1A2E1A/4ADE80?text=Git+Sync',
      },
      {
        id: 'library',
        icon: 'apps',
        title: t('splash-screen.library.title', 'Dashboard creation with saved queries and templates'),
        subtitle: t('splash-screen.library.subtitle', 'Now you can build faster with reusable assets'),
        bullets: [
          t('splash-screen.library.bullet-1', 'Saved queries is redesigned to make reusing queries easier'),
          t('splash-screen.library.bullet-2', 'Gather inspiration from templates and customize them to your needs'),
          t('splash-screen.library.bullet-3', 'Jump-start dashboard creation with suggestions tailored to your data'),
        ],
        ctaText: t('splash-screen.library.cta', 'Show me'),
        ctaUrl: '/dashboards',
        heroImageUrl: 'https://placehold.co/550x650/1E293B/F59E0B?text=Templates',
      },
      {
        // TODO: Replace with real 4th feature content once confirmed
        id: 'explore',
        icon: 'compass',
        title: t('splash-screen.explore.title', 'Explore your data with a new experience'),
        subtitle: t(
          'splash-screen.explore.subtitle',
          'A redesigned Explore makes it easier to query, visualize, and understand your data.'
        ),
        bullets: [
          t('splash-screen.explore.bullet-1', 'Streamlined query building across all data sources'),
          t('splash-screen.explore.bullet-2', 'Side-by-side comparison of metrics, logs, and traces'),
          t('splash-screen.explore.bullet-3', 'Save and share your explorations with your team'),
        ],
        ctaText: t('splash-screen.explore.cta', 'Show me'),
        ctaUrl: '/explore',
        heroImageUrl: 'https://placehold.co/480x580/0F172A/38BDF8?text=Explore',
      },
    ],
  };
}
