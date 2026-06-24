import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LinkButton, Stack, Text } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { useIrmPlugin, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HomeSection } from '../../HomeSection';
import { type HomeWidgetCatalogEntry } from '../types';

interface LinkCardWidgetProps {
  icon: IconName;
  title: string;
  description: string;
  href: string;
  cta: string;
}

/**
 * Curated widgets are CTA cards that deep-link into the installed IRM app. There is no in-repo data
 * API for incidents/on-call/investigations yet, so the POC links to the app root; a richer in-place
 * view can later arrive via the open `grafana/homepage/widget/v1` extension point.
 */
function LinkCardWidget({ icon, title, description, href, cta }: LinkCardWidgetProps) {
  return (
    <HomeSection>
      <Stack direction="column" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={icon} size="lg" />
          <Text element="h4">{title}</Text>
        </Stack>
        <Text color="secondary">{description}</Text>
        <Stack direction="row">
          <LinkButton href={href} icon="external-link-alt" variant="secondary">
            {cta}
          </LinkButton>
        </Stack>
      </Stack>
    </HomeSection>
  );
}

/** Active incidents — gated on the IRM (or legacy Incident) plugin being installed. */
export function useIncidentsWidget(): HomeWidgetCatalogEntry | null {
  const { pluginId, loading, installed } = useIrmPlugin(SupportedPlugin.Incident);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'incidents',
    title: t('home.widgets.incidents.title', 'Active incidents'),
    description: t('home.widgets.incidents.description', 'Open incidents in your IRM app'),
    icon: 'bell',
    source: 'curated',
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 8, h: 6 },
    render: () => (
      <LinkCardWidget
        icon="bell"
        title={t('home.widgets.incidents.title', 'Active incidents')}
        description={t('home.widgets.incidents.description', 'Open incidents in your IRM app')}
        href={createBridgeURL(pluginId, '')}
        cta={t('home.widgets.incidents.cta', 'View incidents')}
      />
    ),
  };
}

/** On-call shifts — gated on the IRM (or legacy OnCall) plugin being installed. */
export function useOnCallWidget(): HomeWidgetCatalogEntry | null {
  const { pluginId, loading, installed } = useIrmPlugin(SupportedPlugin.OnCall);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'oncall',
    title: t('home.widgets.oncall.title', 'On-call shifts'),
    description: t('home.widgets.oncall.description', 'Who is on call right now'),
    icon: 'clock-nine',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => (
      <LinkCardWidget
        icon="clock-nine"
        title={t('home.widgets.oncall.title', 'On-call shifts')}
        description={t('home.widgets.oncall.description', 'Who is on call right now')}
        href={createBridgeURL(pluginId, '')}
        cta={t('home.widgets.oncall.cta', 'Open on-call')}
      />
    ),
  };
}

/** Investigations — gated on the IRM plugin being installed. */
export function useInvestigationsWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = usePluginBridge(SupportedPlugin.Irm);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'investigations',
    title: t('home.widgets.investigations.title', 'Investigations'),
    description: t('home.widgets.investigations.description', 'Recent investigations in your IRM app'),
    icon: 'bug',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => (
      <LinkCardWidget
        icon="bug"
        title={t('home.widgets.investigations.title', 'Investigations')}
        description={t('home.widgets.investigations.description', 'Recent investigations in your IRM app')}
        href={createBridgeURL(SupportedPlugin.Irm, '')}
        cta={t('home.widgets.investigations.cta', 'Open investigations')}
      />
    ),
  };
}
