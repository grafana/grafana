import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { DeclareIncidentMenuItem } from './DeclareIncidentMenuItem';
import { useNotebookIncidents } from './useNotebookIncidents';

// The availability rules are this hook's own, and are covered by its tests; here it is the seam
// that decides whether the item exists at all.
jest.mock('./useNotebookIncidents', () => ({
  ...jest.requireActual('./useNotebookIncidents'),
  useNotebookIncidents: jest.fn(),
}));

const mockUseNotebookIncidents = jest.mocked(useNotebookIncidents);

function setup(available: boolean) {
  mockUseNotebookIncidents.mockReturnValue({ pluginId: SupportedPlugin.Irm, available });

  return render(
    <Menu>
      <DeclareIncidentMenuItem uid="nb1" title="PromQL query (4)" />
    </Menu>
  );
}

describe('DeclareIncidentMenuItem', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  // Rendered rather than disabled-with-a-tooltip, which is what the shared alerting menu item does:
  // on a stack with no IRM that would be a permanently dead entry in every notebook's menu.
  it('renders nothing at all when IRM is unavailable', () => {
    setup(false);

    expect(screen.queryByText('Declare incident')).not.toBeInTheDocument();
  });

  // The notebook's own title, unmodified, and the absolute url — which is what IRM turns into
  // attached context on the incident it creates.
  it('deep-links to the declare form prefilled with the notebook', () => {
    setup(true);

    const link = screen.getByRole('menuitem', { name: 'Declare incident' });
    const href = link.getAttribute('href') ?? '';
    const params = new URLSearchParams(href.split('?')[1]);

    expect(href.split('?')[0]).toBe('/a/grafana-irm-app/incidents/declare');
    expect(params.get('title')).toBe('PromQL query (4)');
    expect(params.get('url')).toBe('https://grafana.example/notebooks/nb1');
    // Left for the form to ask about — a notebook says nothing about how bad the thing is.
    expect(params.get('severity')).toBeNull();
  });
});
