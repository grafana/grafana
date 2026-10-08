export async function loadSandboxRuntime(): Promise<string> {
  return (await import('./sandboxRuntime?text-panel-runtime')).default;
}
