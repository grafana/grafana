import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';

import { generatedAPI as notificationsAPIv1beta1 } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { act, render, screen } from '../../../../../tests/test-utils';
import { DEFAULT_ROUTING_TREE_NAME_ALIAS, USER_DEFINED_TREE_NAME } from '../../routingTrees';

import { RoutingTreeSelector } from './RoutingTreeSelector';
import {
  routingTreeWithErrorScenario,
  simpleRoutingTreesList,
  simpleRoutingTreesListDefaultAliasScenario,
  simpleRoutingTreesListScenario,
  singleDefaultTreeList,
  singleDefaultTreeScenario,
} from './RoutingTreeSelector.scenario';

const server = setupMockServer();

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

beforeAll(() => {
  mockComboboxRect();
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

  it('should show "Default policy" when value is an empty string', async () => {
    const onChangeHandler = jest.fn();

    // Callers that use "" as their own "no name means default" convention (rather than the
    // tree's raw backend name) should still get the default tree selected.
    render(<RoutingTreeSelector value="" onChange={onChangeHandler} />);

    expect(await screen.findByDisplayValue(/default policy/i)).toBeInTheDocument();
  });

  it('should still show a value that is not in the list', async () => {
    // The tree may have been deleted, or the list may only contain the trees this user can read.
    // Either way the input must not go blank, or the caller's current value becomes invisible.
    render(<RoutingTreeSelector value="tree-not-in-the-list" onChange={jest.fn()} />);

    expect(await screen.findByDisplayValue('tree-not-in-the-list')).toBeInTheDocument();
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

describe('multi select', () => {
  it('should show all options and allow selecting multiple trees', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreeSelector multi value={[]} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(simpleRoutingTreesList.items.length);

    // Select first custom tree
    await user.click(await screen.findByRole('option', { name: /team-platform/i }));

    expect(onChangeHandler).toHaveBeenCalledWith([
      expect.objectContaining({
        metadata: expect.objectContaining({ name: 'team-platform' }),
      }),
    ]);
  });

  it('should show pre-selected value as a pill', async () => {
    const onChangeHandler = jest.fn();

    render(<RoutingTreeSelector multi value={[USER_DEFINED_TREE_NAME]} onChange={onChangeHandler} />);

    // MultiCombobox renders selected values as pills
    expect(await screen.findByText(/default policy/i)).toBeInTheDocument();
  });
});

describe('error handling', () => {
  beforeEach(() => {
    server.use(...routingTreeWithErrorScenario);
  });

  it('should display an error alert when the API request fails', async () => {
    const onChangeHandler = jest.fn();

    render(<RoutingTreeSelector onChange={onChangeHandler} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load notification policies/i)).toBeInTheDocument();
  });
});

describe('default tree presented with the "default" canonical name', () => {
  beforeEach(() => {
    server.use(...simpleRoutingTreesListDefaultAliasScenario);
  });

  it('labels the default tree "Default policy" (not its raw name)', async () => {
    // The input display value is the option LABEL only (no description), so this unambiguously
    // distinguishes the friendly "Default policy" label from the raw "default" name.
    render(<RoutingTreeSelector value={DEFAULT_ROUTING_TREE_NAME_ALIAS} onChange={jest.fn()} />);
    expect(await screen.findByDisplayValue('Default policy')).toBeInTheDocument();
  });

  it('force-sorts the default tree first even when a named tree sorts before it alphabetically', async () => {
    const { user } = render(<RoutingTreeSelector onChange={jest.fn()} />);
    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    // `billing` sorts before `default` alphabetically; the default tree is first only if recognised.
    expect(options[0]).toHaveTextContent(/default policy/i);
  });
});

describe('a refetch that fails after a successful load', () => {
  // This query refetches on mount and on window focus, and RTK Query keeps the last good data
  // alongside the error. Replacing a working dropdown with a warning would throw away both the list
  // and the user's visible selection, so the list has to survive a failed refetch.
  it('keeps showing the list instead of swapping in the error alert', async () => {
    const { store } = render(<RoutingTreeSelector value="team-platform" onChange={jest.fn()} />);
    // The shared test store is typed without its thunk middleware (the full type cannot be written out),
    // so tell TypeScript that dispatch accepts the thunk returned by `initiate`.
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;

    expect(await screen.findByDisplayValue('team-platform')).toBeInTheDocument();

    // Now the endpoint starts failing, and something refetches the entry we're subscribed to.
    server.use(...routingTreeWithErrorScenario);
    await act(async () => {
      await dispatch(notificationsAPIv1beta1.endpoints.listRoutingTree.initiate({}, { forceRefetch: true }));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('team-platform')).toBeInTheDocument();
  });
});
