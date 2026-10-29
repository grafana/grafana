import { HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { listReceiverHandler } from '@grafana/alerting/testing';
import { setupMockServer } from '@grafana/test-utils/server';

import { setupBackendSrv } from '../../../mockApi';
import {
  RECEIVER_NAME,
  RECEIVER_UID,
  listContactPointsEmptyResponseScenario,
  listContactPointsResponse,
} from '../../rule-viewer/ContactPointLink.scenario';

import { GrafanaContactPointGroup } from './ContactPointGroup';

const server = setupMockServer();

beforeAll(() => {
  setupBackendSrv();
});

describe('GrafanaContactPointGroup', () => {
  it('looks the contact point up by title and links to it by its UID', async () => {
    const fieldSelectors: Array<string | null> = [];
    server.use(
      listReceiverHandler(({ request }) => {
        fieldSelectors.push(new URL(request.url).searchParams.get('fieldSelector'));
        return HttpResponse.json(listContactPointsResponse);
      })
    );

    render(
      <GrafanaContactPointGroup name={RECEIVER_NAME} matchedInstancesCount={1}>
        <div>instances</div>
      </GrafanaContactPointGroup>
    );

    const link = await screen.findByRole('link', { name: RECEIVER_NAME });
    expect(link).toHaveAttribute('href', expect.stringContaining(`/receivers/${RECEIVER_UID}/edit`));
    expect(fieldSelectors).toContain(`spec.title=${RECEIVER_NAME}`);
  });

  it('does not link when no contact point has that title', async () => {
    server.use(...listContactPointsEmptyResponseScenario);

    render(
      <GrafanaContactPointGroup name="missing" matchedInstancesCount={1}>
        <div>instances</div>
      </GrafanaContactPointGroup>
    );

    expect(await screen.findByText(/missing/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'missing' })).not.toBeInTheDocument();
  });
});
