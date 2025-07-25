import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useCallback } from 'react';

import { createDataFrame, createTheme } from '@grafana/data';

import { FlameGraphDataContainer } from './FlameGraph/dataTransform';
import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphContainer, { labelSearch } from './FlameGraphContainer';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from './constants';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(() => [false, null]), // [isAvailable, openAssistant]
  createContext: jest.fn(),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => {
    const ref = useRef();
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
    expect(screen.getByDisplayValue('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    // Unclick the selection so that we can click something else and continue test checks
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);

    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[1]);
    expect(screen.getByDisplayValue('total')).toBeInTheDocument();
    // after it is highlighted it will be the only (first) item in the table so [1] -> [0]
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);
    expect(screen.queryByDisplayValue('total')).not.toBeInTheDocument();
  });

  it('should render options', async () => {
    render(<FlameGraphContainerWithProps />);
    expect(screen.getByText(/Top Table/)).toBeDefined();
    expect(screen.getByText(/Flame Graph/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should update selected view', async () => {
    render(<FlameGraphContainerWithProps />);

    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.getByTestId('topTable')).toBeDefined();

    await userEvent.click(screen.getByText(/Top Table/));
    expect(screen.queryByTestId('flameGraph')).toBeNull();
    expect(screen.getByTestId('topTable')).toBeDefined();

    await userEvent.click(screen.getByText(/Flame Graph/));
    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.queryByTestId('topTable')).toBeNull();

    await userEvent.click(screen.getByText(/Both/));
    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.getByTestId('topTable')).toBeDefined();
  });

  it('should render both option if screen width >= threshold', async () => {
    global.innerWidth = MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH;
    global.dispatchEvent(new Event('resize')); // Trigger the window resize event
    render(<FlameGraphContainerWithProps />);

    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should not render both option if screen width < threshold', async () => {
    global.innerWidth = MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH - 1;
    global.dispatchEvent(new Event('resize'));
    render(<FlameGraphContainerWithProps />);

    expect(screen.queryByTestId(/Both/)).toBeNull();
  });

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
