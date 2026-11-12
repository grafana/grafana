export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
export const ASSISTANT_WORKSPACE_URL = `/a/${ASSISTANT_PLUGIN_ID}/workspace`;

// `/pages/new` is the workspace opened on the page builder, so it gets the same top bar.
const WORKSPACE_PATHS = [ASSISTANT_WORKSPACE_URL, `/a/${ASSISTANT_PLUGIN_ID}/pages/new`];

// Per browser tab, so Exit Workspace returns where this tab came from.
const PAGE_BEFORE_WORKSPACE_KEY = 'grafana.assistant.workspace.pageBefore';

interface WorkspaceLocation {
  pathname: string;
  search: string;
  hash: string;
}

interface PageBeforeWorkspace {
  url: string;
  // The assistant sidebar that was open there, reopened when the user leaves the workspace.
  sidebarComponentId?: string;
}

export function isAssistantWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function workspaceUrlFor(chatId: string | undefined): string {
  return chatId ? `${ASSISTANT_WORKSPACE_URL}/${encodeURIComponent(chatId)}` : ASSISTANT_WORKSPACE_URL;
}

export function rememberPageBeforeWorkspace(location: WorkspaceLocation, sidebarComponentId: string | undefined) {
  const page: PageBeforeWorkspace = {
    url: location.pathname + location.search + location.hash,
    sidebarComponentId,
  };
  try {
    window.sessionStorage.setItem(PAGE_BEFORE_WORKSPACE_KEY, JSON.stringify(page));
  } catch {
    // Storage can be full or blocked; Exit Workspace then falls back to Home.
  }
}

export function getPageBeforeWorkspace(): PageBeforeWorkspace | undefined {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(PAGE_BEFORE_WORKSPACE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null || !('url' in stored) || typeof stored.url !== 'string') {
      return undefined;
    }
    const sidebarComponentId =
      'sidebarComponentId' in stored && typeof stored.sidebarComponentId === 'string'
        ? stored.sidebarComponentId
        : undefined;
    return { url: stored.url, sidebarComponentId };
  } catch {
    return undefined;
  }
}
