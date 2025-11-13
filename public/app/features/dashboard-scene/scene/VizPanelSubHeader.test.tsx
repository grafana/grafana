import { render, screen } from '@testing-library/react';

import { VizPanel, type AdHocFiltersVariable, type GroupByVariable } from '@grafana/scenes';

import { VizPanelSubHeader } from './VizPanelSubHeader';

const renderPanelNonApplicableSubHeader = jest.fn((props: Record<string, unknown>) => (
  <div data-testid="panel-non-applicable" data-props={JSON.stringify(props)} />
));

jest.mock('./PanelNonApplicableFiltersSubHeader', () => ({
  PanelNonApplicableFiltersSubHeader: (props: Record<string, unknown>) => renderPanelNonApplicableSubHeader(props),
}));

const mockGetDataSource = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: mockGetDataSource,
  }),
}));

jest.mock('@grafana/scenes', () => {
  class VizPanel {}

  class SceneObjectBase<T> {
    state: T;
    parent?: VizPanel;
    constructor(state: Partial<T>) {
      this.state = state as T;
    }
    addActivationHandler() {}
  }

  class AdHocFiltersVariable {}
  class GroupByVariable {}

  const sceneGraph = {
    getData: jest.fn(),
    getVariables: jest.fn(),
  };

  return {
    SceneObjectBase,
    VizPanel,
    AdHocFiltersVariable,
    GroupByVariable,
    sceneGraph,
  };
});

const { sceneGraph: sceneGraphMock } = jest.requireMock('@grafana/scenes');

describe('VizPanelSubHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sceneGraphMock.getData.mockReturnValue({
      useState: () => ({
        data: {
          request: { targets: [{ refId: 'A', datasource: { uid: 'test-ds' } }] },
        },
      }),
    });
  });

  it('throws when activated outside of VizPanel', () => {
    const subHeader = new VizPanelSubHeader({});
    const activate = Reflect.get(subHeader, 'onActivate') as () => void;

    expect(() => activate.call(subHeader)).toThrow('VizPanelSubHeader can be used only for VizPanel');
  });

  it('renders PanelNonApplicableFiltersSubHeader when datasource supports applicability', async () => {
    mockGetDataSource.mockResolvedValue({ getDrilldownsApplicability: jest.fn() });
    const subHeader = createSubHeader();

    render(<subHeader.Component model={subHeader} />);

    expect(await screen.findByTestId('panel-non-applicable')).toBeInTheDocument();
    expect(renderPanelNonApplicableSubHeader).toHaveBeenCalledWith(
      expect.objectContaining({ filtersVar: { id: 'filters' }, queries: expect.any(Array) })
    );
  });

  it('does not render when hideNonApplicableFilters is true', () => {
    const subHeader = createSubHeader({ hideNonApplicableFilters: true });

    const { container } = render(<subHeader.Component model={subHeader} />);

    expect(container.firstChild).toBeNull();
    expect(renderPanelNonApplicableSubHeader).not.toHaveBeenCalled();
  });

  it('does not render when there are no variables', () => {
    const subHeader = createSubHeader({ includeVariables: false });

    const { container } = render(<subHeader.Component model={subHeader} />);

    expect(container.firstChild).toBeNull();
    expect(renderPanelNonApplicableSubHeader).not.toHaveBeenCalled();
  });

  it('does not render when datasource does not support applicability', async () => {
    mockGetDataSource.mockResolvedValue({});
    const subHeader = createSubHeader();

    const { container } = render(<subHeader.Component model={subHeader} />);

    expect(container.firstChild).toBeNull();
    expect(renderPanelNonApplicableSubHeader).not.toHaveBeenCalled();
  });

  it('does not render when datasource reference is missing', () => {
    sceneGraphMock.getData.mockReturnValue({
      useState: () => ({
        data: { request: { targets: [{ refId: 'A' }] } },
      }),
    });
    const subHeader = createSubHeader();

    const { container } = render(<subHeader.Component model={subHeader} />);

    expect(container.firstChild).toBeNull();
    expect(mockGetDataSource).not.toHaveBeenCalled();
  });
});

function createSubHeader({
  hideNonApplicableFilters = false,
  includeVariables = true,
}: { hideNonApplicableFilters?: boolean; includeVariables?: boolean } = {}) {
  const subHeader = new VizPanelSubHeader({ hideNonApplicableFilters });
  // const vizPanel = new VizPanel({
  //   subHeader,
  // });

  if (includeVariables) {
    jest
      .spyOn(subHeader, 'getAdHocFiltersVariable')
      .mockReturnValue({ id: 'filters' } as unknown as AdHocFiltersVariable);
    jest.spyOn(subHeader, 'getGroupByVariable').mockReturnValue({ id: 'groupBy' } as unknown as GroupByVariable);
  } else {
    jest.spyOn(subHeader, 'getAdHocFiltersVariable').mockReturnValue(undefined);
    jest.spyOn(subHeader, 'getGroupByVariable').mockReturnValue(undefined);
  }

  return subHeader;
}
