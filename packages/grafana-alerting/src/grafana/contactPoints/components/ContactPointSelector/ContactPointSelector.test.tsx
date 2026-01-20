import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen, within } from '../../../../../tests/test-utils';
import { getContactPointDescription } from '../../utils';

import { ContactPointSelector } from './ContactPointSelector';
import {
  contactPointsListWithUnusableItems,
  contactPointsListWithUnusableItemsScenario,
  simpleContactPointsList,
  simpleContactPointsListScenario,
} from './ContactPointSelector.test.scenario';

const server = setupMockServer();

beforeEach(() => {
  server.use(...simpleContactPointsListScenario);
});

beforeAll(() => {
  // @TODO remove or move this, required for testing combobox 😮‍💨
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

describe('listing contact points', () => {
  it('should show a sorted list of contact points', async () => {
    const onChangeHandler = jest.fn();

    // render the contact point selector with includeUnusable=true to show all
    const { user } = render(<ContactPointSelector onChange={onChangeHandler} includeUnusable />);
    await user.click(screen.getByRole('combobox'));

    // make sure all options are rendered
    expect(await screen.findAllByRole('option')).toHaveLength(simpleContactPointsList.items.length);

    for (const item of simpleContactPointsList.items) {
      const option = await screen.findByRole('option', { name: new RegExp(item.spec.title) });
      expect(option).toBeInTheDocument();
      expect(within(option).getByText(getContactPointDescription(item))).toBeInTheDocument();
    }

    // test interaction with combobox and handler contract
    const firstContactPoint = simpleContactPointsList.items[0];

    const firstOption = await screen.findByText(firstContactPoint.spec.title);
    await user.click(firstOption);
    expect(onChangeHandler).toHaveBeenCalledWith(firstContactPoint);
  });
});

describe('filtering out unusable contact points', () => {
  beforeEach(() => {
    server.use(...contactPointsListWithUnusableItemsScenario);
  });

  it('should filter out unusable contact points by default', async () => {
    const onChangeHandler = jest.fn();

    // Default behavior: filter out unusable contact points
    const { user } = render(<ContactPointSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // Only usable contact points should be shown (2 out of 3)
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);

    // The non-usable contact point should NOT be in the list
    const nonUsableContactPoint = contactPointsListWithUnusableItems.items.find(
      (cp) => cp.metadata?.annotations?.['grafana.com/canUse'] === 'false'
    );
    expect(
      screen.queryByRole('option', { name: new RegExp(nonUsableContactPoint!.spec.title) })
    ).not.toBeInTheDocument();

    // The usable contact points should be in the list
    const usableContactPoints = contactPointsListWithUnusableItems.items.filter(
      (cp) => cp.metadata?.annotations?.['grafana.com/canUse'] === 'true'
    );
    for (const item of usableContactPoints) {
      expect(await screen.findByRole('option', { name: new RegExp(item.spec.title) })).toBeInTheDocument();
    }
  });

  it('should show all contact points when includeUnusable is true', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<ContactPointSelector onChange={onChangeHandler} includeUnusable />);
    await user.click(screen.getByRole('combobox'));

    // All contact points should be shown
    expect(await screen.findAllByRole('option')).toHaveLength(contactPointsListWithUnusableItems.items.length);
  });
});
