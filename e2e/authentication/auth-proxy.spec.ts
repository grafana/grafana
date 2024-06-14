import { APIRequestContext, Browser, expect, test } from '@playwright/test';
import { cwd } from 'process';
import { GenericContainer, Network, StartedTestContainer, Wait } from 'testcontainers';
import { Environment } from 'testcontainers/build/types';

let grafanaContainer: StartedTestContainer;
let nginxContainer: StartedTestContainer;
let grafanaHost, nginxHost: string;
let grafanaPort, nginxPort: number;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({}, { title }) => {
  const network = await new Network().start();
  nginxHost = 'localhost';
  nginxPort = 50012;

  // The image version should come from the environment
  grafanaContainer = await new GenericContainer('grafana/grafana-enterprise:11.0.0')
    .withEnvironment(getEnvironmentFor(title))
    .withNetwork(network)
    .withNetworkAliases('grafana')
    .withExposedPorts(3000)
    .withWaitStrategy(Wait.forHttp('/', 3000))
    .start();

  nginxContainer = await new GenericContainer('nginx:1.26.1')
    .withNetwork(network)
    .withName('nginx')
    .withCopyFilesToContainer([
      {
        source: `${cwd()}/e2e/authentication/config/auth-proxy/nginx.conf`,
        target: '/etc/nginx/nginx.conf',
      },
      {
        source: `${cwd()}/e2e/authentication/config/auth-proxy/htpasswd`,
        target: '/etc/nginx/htpasswd',
      },
    ])
    .withExposedPorts({ container: 80, host: 50012 })
    .start();

  grafanaHost = grafanaContainer.getHost();
  grafanaPort = grafanaContainer.getMappedPort(3000);

  console.log(`Grafana is running at http://${grafanaHost}:${grafanaPort}`);
});

test.afterEach(async () => {
  if (grafanaContainer) {
    await grafanaContainer.stop({ remove: true });
  }
  if (nginxContainer) {
    await nginxContainer.stop({ remove: true });
  }
});

test.describe('Auth Proxy', () => {
  test('should login the user successfully', async ({ browser, request }) => {
    const page = await createPageWithHttpCredentials('user1', 'grafana', browser);
    await page.goto(`http://${nginxHost}:${nginxPort}`);
    await page.waitForSelector('text=Welcome to Grafana');

    // verify user
    const userResponse = await getUserFromApi(request);

    await expect(userResponse.status()).toBe(200);
    await expect(userResponse.json()).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        email: 'user1',
        name: '',
        login: 'user1',
        theme: '',
        orgId: 1,
        isGrafanaAdmin: false,
        isDisabled: false,
        isExternal: true,
        isExternallySynced: false,
        isGrafanaAdminExternallySynced: false,
        authLabels: ['Auth Proxy'],
      })
    );
  });

  test('should return 401 when allow_signup is false', async ({ browser, request }) => {
    const page = await createPageWithHttpCredentials('user1', 'grafana', browser);
    await page.goto(`http://${nginxHost}:${nginxPort}`);
    await page.waitForURL(`http://${nginxHost}:${nginxPort}/login`);

    // verify user
    const userResponse = await getUserFromApi(request);

    expect(userResponse.status()).toBe(404);
  });
});

const createPageWithHttpCredentials = async (username: string, password: string, browser: Browser) => {
  const context = await browser.newContext({
    httpCredentials: { username, password },
  });
  return context.newPage();
};

async function getUserFromApi(request: APIRequestContext) {
  return await request.get(`http://${nginxHost}:${nginxPort}/api/users/2`, {
    headers: {
      Authorization: 'Basic YWRtaW46YWRtaW4=',
    },
  });
}

function getEnvironmentFor(testTitle: string): Environment {
  switch (testTitle) {
    case 'should login the user successfully':
      return getGrafanaEnvironmentsForAuthProxy({});
    case 'should return 401 when allow_signup is false':
      return getGrafanaEnvironmentsForAuthProxy({
        GF_AUTH_PROXY_AUTO_SIGN_UP: 'false',
      });
    default:
      throw new Error(`Environment not found for test: ${testTitle}`);
  }
}

function getGrafanaEnvironmentsForAuthProxy(extra: Environment): Environment {
  return {
    GF_AUTH_PROXY_ENABLED: 'true',
    GF_AUTH_PROXY_HEADER_NAME: 'X-WEBAUTH-USER',
    GF_AUTH_PROXY_HEADER_PROPERTY: 'username',
    GF_AUTH_PROXY_AUTO_SIGN_UP: 'true',
    GF_AUTH_DISABLE_LOGIN_FORM: 'true',
    GF_SERVER_ROOT_URL: `http://${nginxHost}:${nginxPort}/`,
    ...extra,
  };
}
