import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useCallback } from 'react';

import { createDataFrame, createTheme } from '@grafana/data';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import FlameGraphContainer, { labelSearch } from './FlameGraphContainer';
import { MIN_WIDTH_FOR_SPLIT_VIEW } from '../constants';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn().mockReturnValue({
    isAvailable: false,
    openAssistant: undefined,
  }),
  createAssistantContextItem: jest.fn(),
  OpenAssistantButton: () => <div>OpenAssistantButton</div>,
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => {
    const ref = useRef(null);
    return [ref, { width: 1600 }];
  },
}));

describe('FlameGraphContainer', () => {
  // Needed for AutoSizer to work in test
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: jest.fn(() => ({
      width: 500,
      height: 500,
      left: 0,
    })),
  });

  const FlameGraphContainerWithProps = () => {
    const flameGraphData = createDataFrame(data);
    flameGraphData.meta = {
      custom: {
        ProfileTypeID: 'cpu:foo:bar',
      },
    };

    const getTheme = useCallback(() => createTheme({ colors: { mode: 'dark' } }), []);
    return <FlameGraphContainer data={flameGraphData} getTheme={getTheme} />;
  };

  it('should render without error', async () => {
    expect(() => render(<FlameGraphContainerWithProps />)).not.toThrow();
  });

  it('should update search when row selected in top table', async () => {
    render(<FlameGraphContainerWithProps />);
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);
    expect(screen.getByDisplayValue('^net/http\\.HandlerFunc\\.ServeHTTP$')).toBeInTheDocument();
    // Unclick the selection so that we can click something else and continue test checks
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);

    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[1]);
    expect(screen.getByDisplayValue('^total$')).toBeInTheDocument();
    // after it is highlighted it will be the only (first) item in the table so [1] -> [0]
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);
    expect(screen.queryByDisplayValue('^total$')).not.toBeInTheDocument();
  });

  it('should render pane view options in multi mode', async () => {
    // Default is Multi mode with Split view, showing two pane selectors
    render(<FlameGraphContainerWithProps />);
    // In split mode, there are 2 pane selectors, each with Top Table, Flame Graph, Call Tree
    expect(screen.getAllByText(/Top Table/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Flame Graph/).length).toBeGreaterThanOrEqual(2);
    // View mode options: Single/Split (as radio buttons)
    expect(screen.getByRole('radio', { name: /Single view/ })).toBeDefined();
    expect(screen.getByRole('radio', { name: /Split view/ })).toBeDefined();
  });

  it('should switch to single view mode', async () => {
    render(<FlameGraphContainerWithProps />);

    // Start in Multi + Split mode - both views visible
    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.getByTestId('topTable')).toBeDefined();

    // Switch to Single mode using the ViewMode radio button
    await userEvent.click(screen.getByRole('radio', { name: /Single view/ }));

    // In single mode, only one pane selector should be present
    expect(screen.getAllByText(/Top Table/).length).toBe(1);
  });

  it('should render multi option if screen width >= threshold', async () => {
    global.innerWidth = MIN_WIDTH_FOR_SPLIT_VIEW;
    global.dispatchEvent(new Event('resize'));
    render(<FlameGraphContainerWithProps />);

    // Multi mode is default, view mode options should be visible
    expect(screen.getByText(/Split/)).toBeDefined();
  });

  // Note: Testing narrow width behavior requires dynamic useMeasure mock
  // which is complex to set up. The narrow width logic switches from Multi
  // to a specific view when containerWidth < threshold, hiding Split/Single options.

  it('should filter table items based on search input', async () => {
    // Render the FlameGraphContainer with necessary props
    render(<FlameGraphContainerWithProps />);

    // Checking for presence of this function before filter
    const matchingText1 = 'net/http.HandlerFunc.ServeHTTP';
    const matchingText2 = 'runtime.gcBgMarkWorker';
    const nonMatchingText = 'runtime.systemstack';

    expect(screen.queryAllByText(matchingText1).length).toBe(1);
    expect(screen.queryAllByText(matchingText2).length).toBe(1);
    expect(screen.queryAllByText(nonMatchingText).length).toBe(1);

    // Apply the filter
    const searchInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(searchInput, 'Handler serve,gcBgMarkWorker');

    // We have to wait for filter to take effect
    await waitFor(() => {
      expect(screen.queryAllByText(nonMatchingText).length).toBe(0);
    });
    // Check we didn't lose the one that should match
    expect(screen.queryAllByText(matchingText1).length).toBe(1);
    expect(screen.queryAllByText(matchingText2).length).toBe(1);
  });
});

describe('labelSearch', () => {
  let container: FlameGraphDataContainer;

  beforeEach(() => {
    const df = createDataFrame(data);
    df.meta = {
      custom: {
        ProfileTypeID: 'cpu:foo:bar',
      },
    };

    container = new FlameGraphDataContainer(df, { collapsing: false });
  });

  describe('fuzzy', () => {
    it('single term', () => {
      const search = 'test pkg';
      let found = labelSearch(search, container);
      expect(found.size).toBe(45);
    });

    it('multiple terms', () => {
      const search = 'test pkg,compress';
      let found = labelSearch(search, container);
      expect(found.size).toBe(107);
    });

    it('falls back to fuzzy with malformed regex', () => {
      const search = 'deduplicatingSlice[.';
      let found = labelSearch(search, container);
      expect(found.size).toBe(1);
    });

    it('no results', () => {
      const search = 'term_not_found';
      let found = labelSearch(search, container);
      expect(found.size).toBe(0);
    });
  });

  describe('regex', () => {
    it('single pattern', () => {
      const term = '\\d$';
      let found = labelSearch(term, container);
      expect(found.size).toBe(61);
    });

    it('multiple patterns', () => {
      const term = '\\d$,^go';
      let found = labelSearch(term, container);
      expect(found.size).toBe(62);
    });

    it('no results', () => {
      const term = 'pattern_not_found';
      let found = labelSearch(term, container);
      expect(found.size).toBe(0);
    });
  });

  describe('fuzzy and regex', () => {
    it('regex found, fuzzy found', () => {
      const term = '\\d$,test pkg';
      let found = labelSearch(term, container);
      expect(found.size).toBe(98);
    });

    it('regex not found, fuzzy found', () => {
      const term = 'not_found_suffix$,test pkg';
      let found = labelSearch(term, container);
      expect(found.size).toBe(45);
    });

    it('regex found, fuzzy not found', () => {
      const term = '\\d$,not_found_fuzzy';
      let found = labelSearch(term, container);
      expect(found.size).toBe(61);
    });

    it('regex not found, fuzzy not found', () => {
      const term = 'not_found_suffix$,not_found_fuzzy';
      let found = labelSearch(term, container);
      expect(found.size).toBe(0);
    });

    it('does not match empty terms', () => {
      const search = ',,,,,';
      let found = labelSearch(search, container);
      expect(found.size).toBe(0);
    });
  });
});
