import { useEffect, useState } from 'react';

import { createAssistantContextItem, useProvidePageContext } from '@grafana/assistant';

import { type DashboardScene } from '../scene/DashboardScene';

interface RegistrationFields {
  uid: string;
  title: string;
  folderUid?: string;
  folderTitle?: string;
  isSnapshot: boolean;
  isEmbedded: boolean;
}

/**
 * Registers the active dashboard as Grafana Assistant page context so
 * the assistant chat surface can pick it up without the user having
 * to `@`-mention the dashboard by name.
 *
 * Why this lives here rather than inside the Assistant SDK:
 *  - the dashboard scene state (uid, title, folder) is only available
 *    inside the dashboard runtime; nothing else should reach in.
 *  - the URL scope (`/^\/d\//`) is the dashboard route shape this
 *    application owns. Other dashboard surfaces (snapshots, public
 *    dashboards) live at different paths and are intentionally
 *    excluded so they don't get auto-grounded.
 *
 * What downstream uses it for:
 *  - the Grafana Assistant app (`grafana-assistant-app`) reads this
 *    context via `usePageContext()` in its grounding hook
 *    (`useDashboardIntentGrounding`) and auto-injects the dashboard's
 *    intent into chat without an explicit pill — so a chat opened
 *    while viewing a dashboard already knows what that dashboard is
 *    meant to monitor.
 *
 * Snapshots and embedded dashboards have no useful intent context to
 * inject (no stable UID on the wire, no per-tenant ownership), so we
 * skip registering for those even when they happen to render via the
 * same scene. Dashboards without a UID (new / unsaved) are skipped
 * for the same reason — there's nothing for downstream consumers to
 * key off.
 */
export function useDashboardPageContext(dashboard: DashboardScene | undefined): void {
  // Scope the registration to the dashboard route family. Other
  // assistant-aware pages (Explore, Drilldown, etc.) own their own
  // regex and we don't want to clobber theirs by registering at the
  // root.
  const setContext = useProvidePageContext(/^\/d\//);

  // Track the fields we care about with a local snapshot so we can
  // subscribe manually to the scene without violating React's rules of
  // hooks (the scene reference can be undefined on the first render
  // path, so we can't call `dashboard.useState()` conditionally).
  const [fields, setFields] = useState<RegistrationFields | undefined>(() => extractFields(dashboard));

  useEffect(() => {
    if (!dashboard) {
      setFields(undefined);
      return;
    }

    setFields(extractFields(dashboard));

    const sub = dashboard.subscribeToState(() => {
      setFields(extractFields(dashboard));
    });

    return () => sub.unsubscribe();
  }, [dashboard]);

  useEffect(() => {
    if (!fields || fields.isSnapshot || fields.isEmbedded) {
      setContext([]);
      return;
    }

    setContext([
      createAssistantContextItem('dashboard', {
        dashboardUid: fields.uid,
        dashboardTitle: fields.title,
        folderUid: fields.folderUid,
        folderTitle: fields.folderTitle,
      }),
    ]);
  }, [fields, setContext]);
}

function extractFields(dashboard: DashboardScene | undefined): RegistrationFields | undefined {
  if (!dashboard) {
    return undefined;
  }
  const { uid, title, meta } = dashboard.state;
  if (!uid || !title) {
    return undefined;
  }
  return {
    uid,
    title,
    folderUid: meta.folderUid,
    folderTitle: meta.folderTitle,
    isSnapshot: Boolean(meta.isSnapshot),
    isEmbedded: Boolean(meta.isEmbedded),
  };
}
