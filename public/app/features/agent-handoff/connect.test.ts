import { config } from '@grafana/runtime';

import { buildCursorMcpInstallDeeplink, claudeMcpAddCommand, mcpInstallCommand, mcpServerConfig } from './connect';

describe('MCP client configuration', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    // Trailing slash included on purpose: root_url conventionally carries one and the
    // agent config must not end up with a double slash in every request.
    config.appUrl = 'https://grafana.example.com/';
  });

  afterAll(() => {
    config.appUrl = originalAppUrl;
  });

  it('points the server at the declared root url, without a trailing slash', () => {
    expect(mcpServerConfig()).toEqual({
      command: 'mcp-grafana',
      args: ['--transport', 'stdio'],
      env: {
        GRAFANA_URL: 'https://grafana.example.com',
        GRAFANA_SERVICE_ACCOUNT_TOKEN: '${GRAFANA_SERVICE_ACCOUNT_TOKEN}',
      },
    });
  });

  it("encodes the server object, not an mcpServers wrapper, in Cursor's install link", () => {
    const link = buildCursorMcpInstallDeeplink();
    const url = new URL(link);

    expect(link.startsWith('cursor://anysphere.cursor-deeplink/mcp/install?')).toBe(true);
    expect(url.searchParams.get('name')).toBe('grafana');
    expect(JSON.parse(atob(url.searchParams.get('config') ?? ''))).toEqual({
      command: 'mcp-grafana',
      args: ['--transport', 'stdio'],
      env: {
        GRAFANA_URL: 'https://grafana.example.com',
        GRAFANA_SERVICE_ACCOUNT_TOKEN: '${GRAFANA_SERVICE_ACCOUNT_TOKEN}',
      },
    });
  });

  it('builds a Claude Code command that names the token variable instead of a value', () => {
    expect(claudeMcpAddCommand()).toBe(
      'claude mcp add -s user grafana -e GRAFANA_URL=https://grafana.example.com ' +
        "-e 'GRAFANA_SERVICE_ACCOUNT_TOKEN=${GRAFANA_SERVICE_ACCOUNT_TOKEN}' -- mcp-grafana --transport stdio"
    );
  });

  it('installs the binary the config names, to the PATH a Go toolchain already has', () => {
    // Regression test for the second dead end found by running it: neither client
    // verifies the command exists, so registering `mcp-grafana` without installing it
    // succeeds and then fails on every call.
    expect(mcpInstallCommand()).toBe(
      'GOBIN="$HOME/go/bin" go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest'
    );
    expect(mcpServerConfig().command).toBe('mcp-grafana');
  });

  it('stores the token as a reference the shell cannot expand at add time', () => {
    // Regression test for the third dead end found by running it: the unquoted $VAR
    // form expands in the user's shell, so anyone who has not already exported the
    // token registers an empty one and `claude mcp add` accepts it silently.
    expect(claudeMcpAddCommand()).toContain("-e 'GRAFANA_SERVICE_ACCOUNT_TOKEN=${GRAFANA_SERVICE_ACCOUNT_TOKEN}'");
  });

  it('registers the server at user scope, so a deep-linked session can see it', () => {
    // Regression test for a dead end found by running it: `claude-cli://open` carries no
    // cwd, so the session opens in the user's home directory, while Claude Code's
    // default `local` scope registers a server only for the directory the command ran
    // in. Someone who ran this in their Grafana checkout got a session with no
    // run_panel_query, which cannot act on the prompt at all.
    expect(claudeMcpAddCommand()).toContain('-s user');
  });
});
