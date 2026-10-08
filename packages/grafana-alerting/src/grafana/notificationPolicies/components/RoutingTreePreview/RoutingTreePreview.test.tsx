import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import {
  simpleRoutingTreesList,
  simpleRoutingTreesListDefaultAlias,
  simpleRoutingTreesListDefaultAliasScenario,
  simpleRoutingTreesListScenario,
} from '../RoutingTreeSelector/RoutingTreeSelector.scenario';

import { RoutingTreePreview } from './RoutingTreePreview';

const server = setupMockServer();

const instances = [[['severity', 'critical']]] as Array<Array<[string, string]>>;
const [defaultTree, namedTree] = simpleRoutingTreesList.items;

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

describe('RoutingTreePreview', () => {
  it('lists the receiver of the route that matches the instances in the named tree', async () => {
    render(<RoutingTreePreview routingTreeName={namedTree.metadata.name} instances={instances} />);

    expect(await screen.findByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(namedTree.spec.defaults.receiver!)).toBeInTheDocument();
  });

  it.each([undefined, '', 'user-defined'])('previews the default policy for the name %p', async (name) => {
    render(<RoutingTreePreview routingTreeName={name} instances={instances} />);

    expect(await screen.findByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(defaultTree.spec.defaults.receiver!)).toBeInTheDocument();
  });

  it('previews the default policy when the backend names it with the `default` alias', async () => {
    server.use(...simpleRoutingTreesListDefaultAliasScenario);

    render(<RoutingTreePreview routingTreeName="default" instances={instances} />);

    expect(
      await screen.findByText(simpleRoutingTreesListDefaultAlias.items[0].spec.defaults.receiver!)
    ).toBeInTheDocument();
  });

  it('renders nothing while the tree list is still loading', () => {
    const { renderResult } = render(
      <RoutingTreePreview routingTreeName={namedTree.metadata.name} instances={instances} />
    );

    expect(renderResult.container).toBeEmptyDOMElement();
  });
});
