// Whether fullscreen workspace is active lives in AppChromeService state, which is only reachable
// through React context. This mirrors it so imperative, non-component code can read it too;
// `useFullscreenWorkspace()` keeps it in sync. Components should keep using the hook, so they
// re-render when it changes.
let fullscreenWorkspaceActive = false;

export function setFullscreenWorkspaceActive(active: boolean) {
  fullscreenWorkspaceActive = active;
}

export function isFullscreenWorkspaceActive(): boolean {
  return fullscreenWorkspaceActive;
}
