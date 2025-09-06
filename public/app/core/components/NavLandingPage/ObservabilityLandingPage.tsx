import { NavModelItem } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPage } from './NavLandingPage';

const EXTENSION_ID = 'grafana-asserts-app/landing-page-extension/v1';
const NAV_ID = 'observability';

export function ObservabilityLandingPage() {
  const { node } = useNavModel(NAV_ID);
  const children = node.children?.filter((child) => !child.hideFromTabs);

  const { component: ObservabilityLandingPageComponent, isLoading } = usePluginComponent<{
    childrenNodes: NavModelItem[];
  }>(EXTENSION_ID);

  if (isLoading) {
    return null;
  }

  if (ObservabilityLandingPageComponent) {
    return <ObservabilityLandingPageComponent childrenNodes={children || []} />;
  }

  return <NavLandingPage navId={NAV_ID} />;
}
