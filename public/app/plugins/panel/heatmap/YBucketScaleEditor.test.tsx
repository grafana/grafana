import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StandardEditorContext, StandardEditorsRegistryItem } from '@grafana/data';
import { ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';

import { YBucketScaleEditor } from './YBucketScaleEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<ScaleDistributionConfig | undefined> = {
  id: 'yBucketScale',
  name: 'Y Bucket Scale',
  editor: YBucketScaleEditor,
};

describe('YBucketScaleEditor', () => {
  describe('Scale selection', () => {
    it('should render with Auto selected when value is undefined', () => {
      const onChange = jest.fn();
      render(<YBucketScaleEditor value={undefined} onChange={onChange} context={mockContext} item={mockItem} />);

      const autoButton = screen.getByRole('radio', { name: /auto/i });
      expect(autoButton).toBeChecked();
    });

    it('should render with Linear selected when value is Linear', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Linear }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      const linearButton = screen.getByRole('radio', { name: /linear/i });
      expect(linearButton).toBeChecked();
    });

    it('should call onChange with undefined when Auto is selected', async () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Linear }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      const autoButton = screen.getByRole('radio', { name: /auto/i });
      await userEvent.click(autoButton);

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('should call onChange with Linear config when Linear is selected', async () => {
      const onChange = jest.fn();
      render(<YBucketScaleEditor value={undefined} onChange={onChange} context={mockContext} item={mockItem} />);

      const linearButton = screen.getByRole('radio', { name: /linear/i });
      await userEvent.click(linearButton);

      expect(onChange).toHaveBeenCalledWith({ type: ScaleDistribution.Linear });
    });

    it('should call onChange with Log config when Log is selected', async () => {
      const onChange = jest.fn();
      render(<YBucketScaleEditor value={undefined} onChange={onChange} context={mockContext} item={mockItem} />);

      const logButton = screen.getByRole('radio', { name: /^log$/i });
      await userEvent.click(logButton);

      expect(onChange).toHaveBeenCalledWith({ type: ScaleDistribution.Log, log: 2 });
    });

    it('should call onChange with Symlog config when Symlog is selected', async () => {
      const onChange = jest.fn();
      render(<YBucketScaleEditor value={undefined} onChange={onChange} context={mockContext} item={mockItem} />);

      const symlogButton = screen.getByRole('radio', { name: /symlog/i });
      await userEvent.click(symlogButton);

      expect(onChange).toHaveBeenCalledWith({ type: ScaleDistribution.Symlog, log: 2, linearThreshold: 1 });
    });
  });

  describe('Log base selection', () => {
    it('should show log base selector for Log scale', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Log, log: 2 }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('Log base')).toBeInTheDocument();
    });

    it('should show log base selector for Symlog scale', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Symlog, log: 2, linearThreshold: 1 }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('Log base')).toBeInTheDocument();
    });

    it('should not show log base selector for Linear scale', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Linear }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.queryByText('Log base')).not.toBeInTheDocument();
    });

    it('should not show log base selector for Auto', () => {
      const onChange = jest.fn();
      render(<YBucketScaleEditor value={undefined} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.queryByText('Log base')).not.toBeInTheDocument();
    });

    it('should preserve existing log base when switching to Log', async () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Symlog, log: 10, linearThreshold: 1 }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      const logButton = screen.getByRole('radio', { name: /^log$/i });
      await userEvent.click(logButton);

      expect(onChange).toHaveBeenCalledWith({ type: ScaleDistribution.Log, log: 10 });
    });
  });

  describe('Linear threshold', () => {
    it('should show linear threshold input for Symlog scale', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Symlog, log: 2, linearThreshold: 1 }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('Linear threshold')).toBeInTheDocument();
    });

    it('should not show linear threshold input for Log scale', () => {
      const onChange = jest.fn();
      render(
        <YBucketScaleEditor
          value={{ type: ScaleDistribution.Log, log: 2 }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.queryByText('Linear threshold')).not.toBeInTheDocument();
    });

    it('should not update linear threshold for a 0 value', async () => {
      const onChange = jest.fn();
      const origValue = { type: ScaleDistribution.Symlog, log: 10, linearThreshold: 1 };

      render(<YBucketScaleEditor value={{ ...origValue }} onChange={onChange} context={mockContext} item={mockItem} />);

      const input = screen.getByPlaceholderText('1');

      await userEvent.clear(input);
      await userEvent.type(input, '0');
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.type(input, '.');
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.type(input, '5');
      expect(onChange).toHaveBeenCalledWith({ ...origValue, linearThreshold: 0.5 });
    });

    it('should update linear threshold for valid non-zero values', async () => {
      const onChange = jest.fn();
      const origValue = { type: ScaleDistribution.Symlog, log: 2, linearThreshold: 1 };

      render(<YBucketScaleEditor value={{ ...origValue }} onChange={onChange} context={mockContext} item={mockItem} />);

      const input = screen.getByPlaceholderText('1');

      await userEvent.clear(input);
      await userEvent.type(input, '5');
      expect(onChange).toHaveBeenCalledWith({ ...origValue, linearThreshold: 5 });
    });

    it('should not dispatch onChange for invalid input', async () => {
      const onChange = jest.fn();
      const origValue = { type: ScaleDistribution.Symlog, log: 2, linearThreshold: 1 };

      render(<YBucketScaleEditor value={{ ...origValue }} onChange={onChange} context={mockContext} item={mockItem} />);

      const input = screen.getByPlaceholderText('1');

      await userEvent.clear(input);
      await userEvent.type(input, 'abc');
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
