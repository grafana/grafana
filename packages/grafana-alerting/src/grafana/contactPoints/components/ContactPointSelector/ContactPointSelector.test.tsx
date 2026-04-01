import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen, within } from '../../../../../tests/test-utils';
import { getContactPointDescription } from '../../utils';

import { ContactPointSelector } from './ContactPointSelector';
import {
  contactPointsListWithUnusableItems,
  contactPointsListWithUnusableItemsScenario,
  simpleContactPointsList,
  simpleContactPointsListScenario,
} from './ContactPointSelector.scenario';

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

    const { user } = render(<ContactPointSelector onChange={onChangeHandler} />);
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

describe('imported contact points', () => {
  beforeEach(() => {
    server.use(...contactPointsListWithUnusableItemsScenario);
  });

  it('should show imported contact points as disabled', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<ContactPointSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // All contact points should be shown (2 usable + 1 imported)
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(contactPointsListWithUnusableItems.items.length);

    // The imported contact point should be present but disabled
    const importedContactPoint = contactPointsListWithUnusableItems.items.find(
      (cp) => cp.metadata?.annotations?.['grafana.com/canUse'] === 'false'
    );
    const importedOption = screen.getByRole('option', { name: new RegExp(importedContactPoint!.spec.title) });
    expect(importedOption).toBeInTheDocument();
    expect(importedOption).toHaveAttribute('aria-disabled', 'true');
    expect(within(importedOption).getByText('Imported contact points cannot be used in routes')).toBeInTheDocument();

    // The usable contact points should be present and enabled
    const usableContactPoints = contactPointsListWithUnusableItems.items.filter(
      (cp) => cp.metadata?.annotations?.['grafana.com/canUse'] === 'true'
    );
    for (const item of usableContactPoints) {
      const option = await screen.findByRole('option', { name: new RegExp(item.spec.title) });
      expect(option).toBeInTheDocument();
      expect(option).toHaveAttribute('aria-disabled', 'false');
    }
  });

  it('should show usable contact points before imported ones', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<ContactPointSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');

    const importedContactPoint = contactPointsListWithUnusableItems.items.find(
      (cp) => cp.metadata?.annotations?.['grafana.com/canUse'] === 'false'
    );

    const importedIndex = options.findIndex((opt) => opt.textContent?.includes(importedContactPoint!.spec.title));
    const usableIndices = options.map((opt, i) => i).filter((i) => i !== importedIndex);

    // All usable options should appear before the imported one
    expect(usableIndices.every((i) => i < importedIndex)).toBe(true);
  });
});
