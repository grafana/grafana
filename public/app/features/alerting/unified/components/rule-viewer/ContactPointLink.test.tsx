import { HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { listReceiverHandler } from '@grafana/alerting/testing';
import { setupMockServer } from '@grafana/test-utils/server';

import { setupBackendSrv } from '../../mockApi';

import { ContactPointLink } from './ContactPointLink';
import {
  RECEIVER_NAME,
  RECEIVER_UID,
  listContactPointsEmptyResponseScenario,
  listContactPointsResponse,
  listContactPointsScenario,
} from './ContactPointLink.scenario';

const server = setupMockServer();

beforeAll(() => {
  setupBackendSrv();
});

describe('render contact point link', () => {
  it('should render correctly', async () => {
    server.use(...listContactPointsScenario);

    render(<ContactPointLink name={RECEIVER_NAME} />);
    expect(await screen.findByRole('link', { name: RECEIVER_NAME })).toBeInTheDocument();
  });

  it('should link to the receiver by its UID, which is unrelated to its title', async () => {
    server.use(...listContactPointsScenario);

    render(<ContactPointLink name={RECEIVER_NAME} />);
    const link = await screen.findByRole('link', { name: RECEIVER_NAME });
    expect(link).toHaveAttribute('href', expect.stringContaining(`/receivers/${RECEIVER_UID}/edit`));
  });

  it('should look the receiver up by title rather than a name derived from it', async () => {
    const fieldSelectors: Array<string | null> = [];
    server.use(
      listReceiverHandler(({ request }) => {
        fieldSelectors.push(new URL(request.url).searchParams.get('fieldSelector'));
        return HttpResponse.json(listContactPointsResponse);
      })
    );

    render(<ContactPointLink name={RECEIVER_NAME} />);
    await screen.findByRole('link', { name: RECEIVER_NAME });

    expect(fieldSelectors).toEqual([`spec.title=${RECEIVER_NAME}`]);
  });

  it('should render nothing if it fails to find the receiver', async () => {
    server.use(...listContactPointsEmptyResponseScenario);

    const notFound = 'not-found';
    render(<ContactPointLink name={notFound} />);

    // it should be rendered as plain text
    expect(await screen.findByText(notFound)).toBeInTheDocument();
    // but not as link
    expect(screen.queryByRole('link', { name: notFound })).not.toBeInTheDocument();
  });
});
