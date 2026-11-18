import { render, screen } from 'test/test-utils';

import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';

import { LandingTemplates } from './LandingTemplates';

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab', () => ({
  GrafanaTemplatesTab: () => <article data-testid="grafana-card" />,
}));

jest.mock(
  'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension',
  () => ({
    getDashboardTemplatesTab: jest.fn(),
  })
);

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);
const CustomTemplates = () => <article data-testid="custom-card" />;

function renderTemplates(props: Partial<Parameters<typeof LandingTemplates>[0]> = {}) {
  return render(
    <LandingTemplates
      testDataSource={undefined}
      showGrafanaTemplates
      showCustomTemplates
      onSelectTemplate={jest.fn()}
      {...props}
    />
  );
}

describe('LandingTemplates', () => {
  beforeEach(() => {
    mockGetDashboardTemplatesTab.mockReturnValue(CustomTemplates);
  });

  it('lays out custom templates, then the Grafana ones, in one grid', () => {
    renderTemplates();

    const custom = screen.getByTestId('custom-card');
    const grafana = screen.getByTestId('grafana-card');
    expect(custom.parentElement).toBe(grafana.parentElement);
    expect(custom.compareDocumentPosition(grafana) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves out custom templates when they are not available', () => {
    renderTemplates({ showCustomTemplates: false });

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafana-card')).toBeInTheDocument();
  });

  it('leaves out custom templates when no enterprise list is registered', () => {
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    renderTemplates();

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
  });
});
