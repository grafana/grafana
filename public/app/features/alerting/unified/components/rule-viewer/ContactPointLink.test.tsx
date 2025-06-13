import { render, screen } from 'test/test-utils';

import { setupMockServer } from '@grafana/test-utils/server';

import { ContactPointLink } from './ContactPointLink';
import {
  RECEIVER_NAME,
  listContactPointsEmptyResponseScenario,
  listContactPointsScenario,
} from './ContactPointLink.test.scenario';

const server = setupMockServer();

describe('render contact point link', () => {
  it('should render correctly', async () => {
    server.use(...listContactPointsScenario);

    render(<ContactPointLink name={RECEIVER_NAME} />);
    expect(await screen.findByRole('link', { name: RECEIVER_NAME })).toBeInTheDocument();
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
