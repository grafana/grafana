// These assertions guard the version binding, not the mock data. The factories and MSW handlers in
// this folder derive their `apiVersion` / URL from the generated client's API_GROUP + API_VERSION, so
// importing the wrong version's client here would still typecheck (the clients are near-identical) and
// would instead surface as an empty list or a never-resolving query in some unrelated `public/app`
// test. Failing here names the actual problem.
import { ContactPointFactory } from './fakes/Receivers';
import { RoutingTreeFactory } from './fakes/Routes';
import { listReceiverHandler } from './handlers/ReceiverHandlers/listReceiverHandler';
import { listRoutingTreeHandler } from './handlers/RoutingTreeHandlers/listRoutingTreeHandler';

const API_VERSION = 'notifications.alerting.grafana.app/v1beta1';
const BASE_URL = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/default';

describe('notifications v1beta1 mocks', () => {
  it('builds fakes with the v1beta1 apiVersion', () => {
    expect(ContactPointFactory.build().apiVersion).toBe(API_VERSION);
    expect(RoutingTreeFactory.build().apiVersion).toBe(API_VERSION);
  });

  it('registers handlers against v1beta1 URLs', () => {
    expect(listReceiverHandler({ kind: 'ReceiverList', metadata: {}, items: [] }).info.path).toBe(
      `${BASE_URL}/receivers`
    );
    expect(listRoutingTreeHandler({ kind: 'RoutingTreeList', metadata: {}, items: [] }).info.path).toBe(
      `${BASE_URL}/routingtrees`
    );
  });
});
