import { screen, render, findByText, within } from '../../../../../tests/test-utils';
import { getContactPointDescription } from '../../utils';

import { ContactPointSelector } from './ContactPointSelector';
import {
  setupMockServer,
  simpleContactPointsList,
  simpleContactPointsListScenario,
} from './ContactPointSelector.test.scenario';

const server = setupMockServer();
beforeAll(() => {
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

    // @TODO technically we could be matching descriptions of other options by we can't seem to use the "option"
    // semantic roles here when we also have a description
    for (let item of simpleContactPointsList.items) {
      const option = await screen.findByText(item.spec.title);
      expect(option).toBeInTheDocument();
      expect(
        // @ts-expect-error
        within(optionText.closest('[role=option]')).getByText(getContactPointDescription(item))
      ).toBeInTheDocument();
    }

    // test interaction with combobox and handler contract
    const firstContactPoint = simpleContactPointsList.items[0];

    const firstOption = await screen.findByText(firstContactPoint.spec.title);
    await user.click(firstOption);
    expect(onChangeHandler).toHaveBeenCalledWith(firstContactPoint);
  });
});
