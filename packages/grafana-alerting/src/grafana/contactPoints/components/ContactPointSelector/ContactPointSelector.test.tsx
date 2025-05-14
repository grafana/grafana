import server, { setupMockServer } from '@grafana/test-utils/server';

import { screen, render, within } from '../../../../../tests/test-utils';
import { getContactPointDescription } from '../../utils';

import { ContactPointSelector } from './ContactPointSelector';
import { simpleContactPointsList, simpleContactPointsListScenario } from './ContactPointSelector.test.scenario';

setupMockServer();

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

    // render the contact point selector
    const { user } = render(<ContactPointSelector onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));

    // make sure all options are rendered
    expect(await screen.findAllByRole('option')).toHaveLength(simpleContactPointsList.items.length);

    for (let item of simpleContactPointsList.items) {
      const optionText = await screen.findByText(item.spec.title);
      expect(optionText).toBeInTheDocument();

      const option = optionText.closest<HTMLElement>('[role=option]');
      expect(within(option!).getByText(getContactPointDescription(item))).toBeInTheDocument();
    }

    // test interaction with combobox and handler contract
    const firstContactPoint = simpleContactPointsList.items[0];

    const firstOption = await screen.findByText(firstContactPoint.spec.title);
    await user.click(firstOption);
    expect(onChangeHandler).toHaveBeenCalledWith(firstContactPoint);
  });
});
