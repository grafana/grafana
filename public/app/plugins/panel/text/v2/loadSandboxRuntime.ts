// The custom webpack/Rspack loader returns bundled JavaScript as a string,
// so we can run it inside the iframe instead of the parent page.
export async function loadSandboxRuntime(): Promise<string> {
  return (await import('./sandboxRuntime?text-panel-runtime')).default;
}

let mermaidSource: Promise<string> | undefined;

export function loadSandboxMermaid(): Promise<string> {
  return (mermaidSource ??= import('./sandboxMermaid?text-panel-runtime')
    .then((module) => module.default)
    .catch((error) => {
      mermaidSource = undefined;
      throw error;
    }));
}
