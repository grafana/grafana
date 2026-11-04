import { useLayoutEffect, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { useFlagGrafanaNavigationAdminSubNav } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { NavID } from 'app/core/navtree/constants';

import { SectionNav } from './SectionNav';
import { useSectionNav } from './useSectionNav';

/**
 * Puts the nav of the section the page is in into the chrome's side panel, and
 * takes it out when the page is in none. Renders nothing itself.
 *
 * The only writer of the chrome's side panel, so sections cannot clear each
 * other's: every section is asked in turn and the first with a nav owns the
 * panel. To give another section a side nav, add it to `candidates`.
 */
export function SectionSidePanel() {
  const { chrome } = useGrafana();
  const { pageNav, sectionNav } = chrome.useState();
  const currentPage = pageNav ?? sectionNav.node;

  // Every hook runs on every render, in this order, so the list never changes under React
  const candidates = [
    {
      label: t('navigation.administration-section-nav.label', 'Administration'),
      model: useSectionNav(NavID.cfg, useFlagGrafanaNavigationAdminSubNav(), currentPage),
    },
  ];
  const owner = candidates.find((candidate) => candidate.model);
  const label = owner?.label;
  const model = owner?.model;

  const sidePanel = useMemo(
    () => (label && model ? <SectionNav label={label} groups={model.groups} activeId={model.activeId} /> : undefined),
    [label, model]
  );

  // A layout effect, so the panel is in place before the page paints, as with the page's own chrome update
  useLayoutEffect(() => {
    chrome.setSidePanel(sidePanel);
  }, [chrome, sidePanel]);

  useLayoutEffect(() => {
    return () => chrome.setSidePanel(undefined);
  }, [chrome]);

  return null;
}
