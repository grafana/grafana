const PLUGIN_FRAME_RE = /\/(?:public|api)\/plugins\/([a-z0-9][a-z0-9-_]*)\//i;

export function resolvePluginIdFromStack(stack: string | undefined): string {
  if (!stack) {
    return 'unknown';
  }
  for (const line of stack.split('\n')) {
    const match = line.match(PLUGIN_FRAME_RE);
    if (match) {
      return match[1];
    }
  }
  return 'unknown';
}
