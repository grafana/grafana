import { config } from '@grafana/runtime';

/**
 * The client configuration that points an agent's MCP server at this Grafana.
 *
 * "Authenticating Grafana" from a button amounts to producing this: the Grafana MCP
 * server is a local process configured by environment, and it implements no OAuth,
 * authorization server or dynamic client registration.
 *
 * The token is never part of what this module emits. A service account token in a
 * deep link would pass through an OS protocol handler and whatever logs that touches,
 * so the config references the environment variable by name and the user supplies the
 * value where their agent keeps secrets.
 */

export const MCP_SERVER_NAME = 'grafana';
const MCP_COMMAND = 'mcp-grafana';
const MCP_ARGS = ['--transport', 'stdio'];
export const TOKEN_ENV_VAR = 'GRAFANA_SERVICE_ACCOUNT_TOKEN';

/** The url an agent on the user's machine can actually reach. */
export function grafanaUrlForAgent(): string {
  // appUrl, not window.location.origin: root_url is what an operator declared this
  // instance to be reachable at, and it is what a process outside the browser needs.
  return config.appUrl.replace(/\/$/, '');
}

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function mcpServerConfig(): McpServerConfig {
  return {
    command: MCP_COMMAND,
    args: [...MCP_ARGS],
    env: {
      GRAFANA_URL: grafanaUrlForAgent(),
      // A reference rather than a value. Claude Code expands ${VAR} in .mcp.json; an
      // agent that does not will pass the literal string through and fail its first
      // call with an auth error, which is a worse first run but not a leaked token.
      [TOKEN_ENV_VAR]: `\${${TOKEN_ENV_VAR}}`,
    },
  };
}

/**
 * How to get the binary the config above names.
 *
 * Spelled out rather than left to "install the Grafana MCP server", because neither
 * client checks that the command exists: `claude mcp add` accepts any string and
 * Cursor's install link writes whatever it is given, so a missing binary registers
 * cleanly and then fails on every call. GOBIN matches the form the server's own README
 * documents, and puts it on the PATH a Go toolchain already has.
 */
export function mcpInstallCommand(): string {
  return `GOBIN="$HOME/go/bin" go install github.com/grafana/mcp-grafana/cmd/${MCP_COMMAND}@latest`;
}

/** Base64 of the config, as Cursor's install link expects it. */
function encodeConfig(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));

  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

/**
 * Cursor's one-click MCP install link. The `config` parameter carries the server
 * object itself, not an `mcpServers` wrapper.
 * https://cursor.com/docs/mcp/install-links
 */
export function buildCursorMcpInstallDeeplink(): string {
  const url = new URL('cursor://anysphere.cursor-deeplink/mcp/install');
  url.searchParams.set('name', MCP_SERVER_NAME);
  url.searchParams.set('config', encodeConfig(mcpServerConfig()));

  return url.toString();
}

/**
 * The command that adds the server to Claude Code.
 *
 * Claude has no deep link that installs an MCP server - its own documentation says
 * the `claude://` links configure no connectors - so this is a command to copy.
 * `$VAR` is left for the user's shell to expand, so the token never appears here.
 *
 * The token is single-quoted so the shell leaves it alone and the literal
 * `${GRAFANA_SERVICE_ACCOUNT_TOKEN}` is what gets stored, matching the Cursor config.
 * The unquoted `$VAR` form expands when the user runs the command, so anyone whose
 * shell does not already export the token silently registers an *empty* one - and
 * `claude mcp add` accepts that without a word, which is the same silent dead-end as
 * a missing binary. An unexpanded reference fails loudly with an auth error instead.
 *
 * `-s user` rather than the default `local` scope, and this is load-bearing: a
 * `claude-cli://open` deep link with no `cwd` opens the session in the user's home
 * directory, while a local-scope server exists only in the directory the command was
 * run from. Someone who registered the server in their Grafana checkout would get a
 * session that cannot see it, and an agent with no run_panel_query cannot act on the
 * prompt at all - a handoff that looks like it worked and then dead-ends. Grafana
 * cannot pass a useful `cwd` either, since it has no idea where the user's checkout
 * is, so the server has to exist everywhere.
 */
export function claudeMcpAddCommand(): string {
  return [
    'claude mcp add',
    '-s user',
    MCP_SERVER_NAME,
    `-e GRAFANA_URL=${grafanaUrlForAgent()}`,
    `-e '${TOKEN_ENV_VAR}=\${${TOKEN_ENV_VAR}}'`,
    '--',
    MCP_COMMAND,
    ...MCP_ARGS,
  ].join(' ');
}
