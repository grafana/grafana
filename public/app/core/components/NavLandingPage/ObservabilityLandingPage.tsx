import { NavModelItem } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPage } from './NavLandingPage';

export function ObservabilityLandingPage() {
  const { node } = useNavModel('observability');
  const children = node.children?.filter((child) => !child.hideFromTabs);

  const { component: ObservabilityLandingPageComponent, isLoading } = usePluginComponent<{
    childrenNodes: NavModelItem[];
  }>('grafana-asserts-app/landing-page-extension/v1');

  if (isLoading) {
    return null;
  }

  if (ObservabilityLandingPageComponent) {
    return <ObservabilityLandingPageComponent childrenNodes={children || []} />;
  }

  return <NavLandingPage navId="observability" />;
}
