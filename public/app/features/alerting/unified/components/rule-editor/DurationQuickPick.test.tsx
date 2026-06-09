import { render, screen, userEvent } from 'test/test-utils';

import { DurationQuickPick } from './DurationQuickPick';

describe('PendingPeriodQuickPick', () => {
  it('should render the correct default preset, set active element and allow selecting other options', async () => {
    const onSelect = jest.fn();
    render(<DurationQuickPick onSelect={onSelect} groupEvaluationInterval={'1m'} selectedDuration={'2m'} />);

    const shouldHaveButtons = ['None', '1m', '2m', '3m', '4m', '5m'];
    const shouldNotHaveButtons = ['0s', '10s', '6m'];

    shouldHaveButtons.forEach((name) => {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    });

    shouldNotHaveButtons.forEach((name) => {
      expect(screen.queryByRole('option', { name })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('2m');

    await userEvent.click(screen.getByRole('option', { name: '3m' }));
    expect(onSelect).toHaveBeenCalledWith('3m');

    await userEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onSelect).toHaveBeenCalledWith('0s');
  });
});
