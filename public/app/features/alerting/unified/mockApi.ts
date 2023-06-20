import { rest } from 'msw';
import { setupServer, SetupServer } from 'msw/node';
import 'whatwg-fetch';

import { setBackendSrv } from '@grafana/runtime';

import { backendSrv } from '../../../core/services/backend_srv';
import {
  AlertmanagerConfig,
  AlertManagerCortexConfig,
  EmailConfig,
  MatcherOperator,
  Receiver,
  Route,
} from '../../../plugins/datasource/alertmanager/types';

class AlertmanagerConfigBuilder {
  private alertmanagerConfig: AlertmanagerConfig = { receivers: [] };

  addReceivers(configure: (builder: AlertmanagerReceiverBuilder) => void): AlertmanagerConfigBuilder {
    const receiverBuilder = new AlertmanagerReceiverBuilder();
    configure(receiverBuilder);
    this.alertmanagerConfig.receivers?.push(receiverBuilder.build());
    return this;
  }

  withRoute(configure: (routeBuilder: AlertmanagerRouteBuilder) => void): AlertmanagerConfigBuilder {
    const routeBuilder = new AlertmanagerRouteBuilder();
    configure(routeBuilder);

    this.alertmanagerConfig.route = routeBuilder.build();

    return this;
  }

  build() {
    return this.alertmanagerConfig;
  }
}

class AlertmanagerRouteBuilder {
  private route: Route = { routes: [], object_matchers: [] };

  withReceiver(receiver: string): AlertmanagerRouteBuilder {
    this.route.receiver = receiver;
    return this;
  }
  withoutReceiver(): AlertmanagerRouteBuilder {
    return this;
  }
  withEmptyReceiver(): AlertmanagerRouteBuilder {
    this.route.receiver = '';
    return this;
  }

  addRoute(configure: (builder: AlertmanagerRouteBuilder) => void): AlertmanagerRouteBuilder {
    const routeBuilder = new AlertmanagerRouteBuilder();
    configure(routeBuilder);
    this.route.routes?.push(routeBuilder.build());
    return this;
  }

  addMatcher(key: string, operator: MatcherOperator, value: string): AlertmanagerRouteBuilder {
    this.route.object_matchers?.push([key, operator, value]);
    return this;
  }

  build() {
    return this.route;
  }
}

class EmailConfigBuilder {
  private emailConfig: EmailConfig = { to: '' };

  withTo(to: string): EmailConfigBuilder {
    this.emailConfig.to = to;
    return this;
  }

  build() {
    return this.emailConfig;
  }
}

class AlertmanagerReceiverBuilder {
  private receiver: Receiver = { name: '', email_configs: [] };

  withName(name: string): AlertmanagerReceiverBuilder {
    this.receiver.name = name;
    return this;
  }

  addEmailConfig(configure: (builder: EmailConfigBuilder) => void): AlertmanagerReceiverBuilder {
    const builder = new EmailConfigBuilder();
    configure(builder);
    this.receiver.email_configs?.push(builder.build());
    return this;
  }

  build() {
    return this.receiver;
  }
}

export function mockApi(server: SetupServer) {
  return {
    getAlertmanagerConfig: (amName: string, configure: (builder: AlertmanagerConfigBuilder) => void) => {
      const builder = new AlertmanagerConfigBuilder();
      configure(builder);

      server.use(
        rest.get(`api/alertmanager/${amName}/config/api/v1/alerts`, (req, res, ctx) =>
          res(
            ctx.status(200),
            ctx.json<AlertManagerCortexConfig>({
              alertmanager_config: builder.build(),
              template_files: {},
            })
          )
        )
      );
    },
  };
}

// Creates a MSW server and sets up beforeAll and afterAll handlers for it
export function setupMswServer() {
  const server = setupServer();

  beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
