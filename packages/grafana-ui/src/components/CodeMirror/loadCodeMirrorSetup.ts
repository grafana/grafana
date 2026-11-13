/**
 * Loads `useCodeMirrorSetup` on demand. `@grafana/ui/internal` is imported by
 * eagerly loaded core code, so it exports this loader instead of the hook to keep
 * CodeMirror out of those chunks.
 */
export const loadCodeMirrorSetup = () => import('./useCodeMirrorSetup').then((module) => module.useCodeMirrorSetup);
