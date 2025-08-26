import { render, screen, userEvent } from 'test/test-utils';

import { EvaluationGroupQuickPick, getEvaluationGroupOptions } from './EvaluationGroupQuickPick';

describe('EvaluationGroupQuickPick', () => {
  it('should render the correct default preset, set active element and allow selecting another option', async () => {
    const onSelect = jest.fn();
    render(<EvaluationGroupQuickPick currentInterval={'10m'} onSelect={onSelect} />);

    const shouldHaveButtons = ['10s', '30s', '1m', '5m', '10m', '15m', '30m', '1h'];
    const shouldNotHaveButtons = ['0s', '2h'];

    shouldHaveButtons.forEach((name) => {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    });

    shouldNotHaveButtons.forEach((name) => {
      expect(screen.queryByRole('option', { name })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('10m');

    await userEvent.click(screen.getByRole('option', { name: '30m' }));
    expect(onSelect).toHaveBeenCalledWith('30m');
  });
});

describe('getEvaluationGroupOptions', () => {
  it('should return the correct default options', () => {
    const options = getEvaluationGroupOptions();
    expect(options).toEqual(['10s', '30s', '1m', '5m', '10m', '15m', '30m', '1h']);
  });

  it('should return the correct options when minInterval is set within set of defaults', () => {
    const options = getEvaluationGroupOptions('1m0s');
    expect(options).toEqual(['1m', '5m', '10m', '15m', '30m', '1h', '2h', '4h']);
  });

  it('should return the correct options when minInterval is set outside set of defaults', () => {
    const options = getEvaluationGroupOptions('12h');
    expect(options).toEqual(['12h', '1d', '1d12h', '2d', '2d12h', '3d', '3d12h', '4d']);
  });
});
