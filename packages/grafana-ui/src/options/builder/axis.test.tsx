import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ScaleDistribution } from '@grafana/schema';

import { ScaleDistributionEditor } from './axis';

describe('ScaleDistributionEditor', () => {
  describe('Symlog', () => {
    it('linear threshold should not dispatch a change for 0', async () => {
      const onChange = jest.fn();
      const origValue = { type: ScaleDistribution.Symlog, log: 10 };

      render(<ScaleDistributionEditor value={{ type: ScaleDistribution.Symlog, log: 10 }} onChange={onChange} />);

      // so annoying that this doesn't work.
      // const el = await screen.findByLabelText('Linear threshold');
      const el = screen.getByTestId('input-wrapper').querySelector('input')!;

      await userEvent.type(el, '0');
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.type(el, '.');
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.type(el, '5');
      expect(onChange).toHaveBeenCalledWith({ linearThreshold: 0.5, ...origValue });

      await userEvent.clear(el);
      expect(onChange).toHaveBeenCalledWith(origValue);
    });

    it('updates the linear threshold input when its value is restored', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      const value = { type: ScaleDistribution.Symlog, log: 10, linearThreshold: 1 };
      const { rerender } = render(<ScaleDistributionEditor value={value} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Linear threshold' });

      await user.clear(input);
      await user.type(input, '5');
      expect(onChange).toHaveBeenLastCalledWith({ ...value, linearThreshold: 5 });
      rerender(<ScaleDistributionEditor value={{ ...value, linearThreshold: 5 }} onChange={onChange} />);

      rerender(<ScaleDistributionEditor value={value} onChange={onChange} />);
      expect(input).toHaveValue(1);

      rerender(<ScaleDistributionEditor value={{ ...value, linearThreshold: 5 }} onChange={onChange} />);
      expect(input).toHaveValue(5);
    });
  });
});
