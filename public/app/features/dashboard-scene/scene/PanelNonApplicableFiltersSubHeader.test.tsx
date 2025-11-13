import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';

import { AdHocVariableFilter, DataQuery } from '@grafana/data';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    Tooltip: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
      <div>
        <div>{children}</div>
        <div>{content}</div>
      </div>
    ),
    useStyles2: () => ({
      container: 'container',
      pill: 'pill',
      disabledPill: 'disabledPill',
      strikethrough: 'strikethrough',
    }),
  };
});

type PanelNonApplicableFiltersSubHeaderProps = ComponentProps<typeof PanelNonApplicableFiltersSubHeader>;

const defaultQueries: DataQuery[] = [{ refId: 'A' } as DataQuery];

const renderComponent = (props: Partial<PanelNonApplicableFiltersSubHeaderProps> = {}) => {
  const mergedProps: PanelNonApplicableFiltersSubHeaderProps = {
    filtersVar: undefined,
    groupByVar: undefined,
    queries: defaultQueries,
    ...props,
  };

  return render(<PanelNonApplicableFiltersSubHeader {...mergedProps} />);
};

describe('PanelNonApplicableFiltersSubHeader', () => {
  const DEFAULT_CONTAINER_WIDTH = 600;
  let originalOffsetWidthDescriptor: PropertyDescriptor | undefined;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  const setContainerWidth = (width: number) => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: width,
    });
  };

  beforeAll(() => {
    originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    setContainerWidth(DEFAULT_CONTAINER_WIDTH);

    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterAll(() => {
    if (originalOffsetWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidthDescriptor);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
    }

    if (originalResizeObserver) {
      window.ResizeObserver = originalResizeObserver;
    } else {
      delete (window as unknown as Record<string, unknown>).ResizeObserver;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setContainerWidth(DEFAULT_CONTAINER_WIDTH);
  });

  it('does not render anything when every filter and group-by value is applicable', async () => {
    const filter: AdHocVariableFilter = { key: 'status', operator: '=', value: '200', origin: 'user' };
    const { variable: filtersVar, mock: filtersApplicabilityMock } = createFiltersVariable({
      filters: [filter],
      applicability: [{ key: 'status', origin: 'user', applicable: true }],
    });

    const { variable: groupByVar, mock: groupByApplicabilityMock } = createGroupByVariable({
      value: ['region'],
      applicability: [{ key: 'region', applicable: true }],
    });

    const { container } = renderComponent({ filtersVar, groupByVar });

    await waitFor(() => {
      expect(filtersApplicabilityMock).toHaveBeenCalledWith([filter], defaultQueries);
      expect(groupByApplicabilityMock).toHaveBeenCalledWith(['region'], defaultQueries);
    });

    expect(container.firstChild).toBeNull();
  });

  it('renders pills for non applicable filters from both filters and origin filters', async () => {
    const filterA: AdHocVariableFilter = { key: 'status', operator: '=', value: '500' };
    const filterB: AdHocVariableFilter = { key: 'team', operator: '=', value: 'payments', origin: 'dashboard' };

    const { variable: filtersVar, mock: filtersApplicabilityMock } = createFiltersVariable({
      filters: [filterA],
      originFilters: [filterB],
      applicability: [
        { key: 'status', applicable: false },
        { key: 'team', origin: 'dashboard', applicable: false },
      ],
    });

    renderComponent({ filtersVar });

    expect(await screen.findByText('status = 500')).toBeInTheDocument();
    expect(screen.getByText('team = payments')).toBeInTheDocument();

    await waitFor(() => {
      expect(filtersApplicabilityMock).toHaveBeenCalledWith([filterA, filterB], defaultQueries);
    });
  });

  it('appends non applicable group-by keys and filter pills', async () => {
    const filter: AdHocVariableFilter = { key: 'latency', operator: '>', value: '100' };
    const { variable: filtersVar } = createFiltersVariable({
      filters: [filter],
      applicability: [{ key: 'latency', applicable: false }],
    });

    const { variable: groupByVar, mock: groupByApplicabilityMock } = createGroupByVariable({
      value: ['region', 'service'],
      applicability: [
        { key: 'region', applicable: false },
        { key: 'service', applicable: true },
      ],
    });

    renderComponent({ filtersVar, groupByVar });

    expect(await screen.findByText('latency > 100')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
    expect(screen.queryByText('service')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(groupByApplicabilityMock).toHaveBeenCalledWith(['region', 'service'], defaultQueries);
    });
  });

  it('renders overflow tooltip with hidden non applicable filters when width is limited', async () => {
    setContainerWidth(60);

    const filterA: AdHocVariableFilter = { key: 'status', operator: '=', value: '500' };
    const filterB: AdHocVariableFilter = { key: 'team', operator: '=', value: 'payments', origin: 'dashboard' };

    const { variable: filtersVar } = createFiltersVariable({
      filters: [filterA],
      originFilters: [filterB],
      applicability: [
        { key: 'status', applicable: false },
        { key: 'team', origin: 'dashboard', applicable: false },
      ],
    });

    renderComponent({ filtersVar });

    expect(await screen.findByText('+2')).toBeInTheDocument();
    expect(screen.getByText('status = 500, team = payments')).toBeInTheDocument();
    expect(screen.queryByText('status = 500', { exact: true })).not.toBeInTheDocument();
  });

  it('gracefully handles errors when resolving filter applicability', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failingFiltersVar = {
      useState: () => ({ filters: [{ key: 'status', operator: '=', value: '500' }] }),
      getFiltersApplicabilityForQueries: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as AdHocFiltersVariable;

    const { container } = renderComponent({ filtersVar: failingFiltersVar });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to resolve ad-hoc filter applicability', expect.any(Error));
    });

    expect(container.firstChild).toBeNull();
    consoleErrorSpy.mockRestore();
  });
});

function createFiltersVariable({
  filters = [],
  originFilters = [],
  applicability = [],
}: {
  filters?: AdHocVariableFilter[];
  originFilters?: AdHocVariableFilter[];
  applicability?: Array<{ key: string; origin?: string; applicable: boolean }>;
}) {
  const mock = jest.fn().mockResolvedValue(applicability);
  const variable = {
    useState: () => ({
      filters,
      originFilters,
    }),
    getFiltersApplicabilityForQueries: mock,
  } as unknown as AdHocFiltersVariable;

  return { variable, mock };
}

function createGroupByVariable({
  value = [],
  applicability = [],
}: {
  value?: string[];
  applicability?: Array<{ key: string; applicable: boolean }>;
}) {
  const mock = jest.fn().mockResolvedValue(applicability);
  const variable = {
    useState: () => ({ value }),
    getGroupByApplicabilityForQueries: mock,
  } as unknown as GroupByVariable;

  return { variable, mock };
}
