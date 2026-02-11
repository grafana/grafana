import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import { USER_DEFINED_TREE_NAME } from '../../consts';

import { RoutingTreeSelector } from './RoutingTreeSelector';
import {
  simpleRoutingTreesList,
  simpleRoutingTreesListScenario,
  singleDefaultTreeList,
  singleDefaultTreeScenario,
} from './RoutingTreeSelector.test.scenario';

const server = setupMockServer();

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

beforeAll(() => {
  // Required for testing combobox
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });
});

describe('listing routing trees', () => {
  it('should show a sorted list of routing trees with default policy first', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // Make sure all options are rendered
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(simpleRoutingTreesList.items.length);

    // Default policy should be displayed with the "Default policy" label
    expect(await screen.findByRole('option', { name: /default policy/i })).toBeInTheDocument();

    // Custom trees should be displayed with their names
    expect(await screen.findByRole('option', { name: /team-platform/i })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /team-backend/i })).toBeInTheDocument();

    // Default policy should be the first option
    const firstOption = options[0];
    expect(firstOption).toHaveTextContent(/default policy/i);
  });

  it('should call onChange with the selected routing tree', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // Select a custom tree
    const customTree = await screen.findByRole('option', { name: /team-platform/i });
    await user.click(customTree);

    // Should have been called with the full RoutingTree object
    expect(onChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ name: 'team-platform' }),
      })
    );
  });

  it('should call onChange with the default tree when "Default policy" is selected', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // Select default policy
    const defaultOption = await screen.findByRole('option', { name: /default policy/i });
    await user.click(defaultOption);

    expect(onChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ name: USER_DEFINED_TREE_NAME }),
      })
    );
  });
});

describe('with single default tree only', () => {
  beforeEach(() => {
    server.use(...singleDefaultTreeScenario);
  });

  it('should show only the default policy option', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(singleDefaultTreeList.items.length);

    expect(await screen.findByRole('option', { name: /default policy/i })).toBeInTheDocument();
  });
});

describe('pre-selection', () => {
  it('should show the selected value when a value prop is provided', async () => {
    const onChangeHandler = jest.fn();

    render(<RoutingTreeSelector value="team-platform" onChange={onChangeHandler} />);

    // The combobox should show the pre-selected value in the input
    expect(await screen.findByDisplayValue('team-platform')).toBeInTheDocument();
  });

  it('should show "Default policy" when the default tree name is selected', async () => {
    const onChangeHandler = jest.fn();

    render(<RoutingTreeSelector value={USER_DEFINED_TREE_NAME} onChange={onChangeHandler} />);

    // Should display the friendly name "Default policy" in the input
    expect(await screen.findByDisplayValue(/default policy/i)).toBeInTheDocument();
  });
});

describe('clearable behavior', () => {
  it('should support clearing when isClearable is true', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector value="team-platform" onChange={onChangeHandler} isClearable />);

    // Verify value is displayed in the input
    expect(await screen.findByDisplayValue('team-platform')).toBeInTheDocument();

    // Clear the selection – the SVG clear icon uses title="Clear value"
    const clearButton = screen.getByTitle(/clear value/i);
    await user.click(clearButton);

    expect(onChangeHandler).toHaveBeenCalledWith(null);
  });
});
