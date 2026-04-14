import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type StandardEditorContext, type StandardEditorsRegistryItem } from '@grafana/data';
import { type LineStyle } from '@grafana/schema';

import { LineStyleEditor } from './LineStyleEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<LineStyle> = {
  id: 'lineStyle',
  name: 'Line style',
  editor: LineStyleEditor,
};

describe('LineStyleEditor', () => {
  describe('Fill style selection', () => {
    it('should render with Solid selected when value is undefined', () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={undefined!} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /solid/i })).toBeChecked();
    });

    it('should call onChange with dash defaults when Dash is selected', async () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /dash/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'dash', dash: [10, 10] });
    });

    it('should call onChange with dot defaults when Dots is selected', async () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /dots/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'dot', dash: [0, 10] });
    });

    it('should call onChange with no dash when Solid is selected', async () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [10, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      await userEvent.click(screen.getByRole('radio', { name: /solid/i }));

      expect(onChange).toHaveBeenCalledWith({ fill: 'solid', dash: undefined });
    });
  });

  describe('Segment selector', () => {
    it('should not show segment selector when fill is solid', () => {
      const onChange = jest.fn();
      render(<LineStyleEditor value={{ fill: 'solid' }} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should show segment selector when fill is dash', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [10, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show default segments when dash array is empty', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor value={{ fill: 'dash', dash: [] }} onChange={onChange} context={mockContext} item={mockItem} />
      );

      expect(screen.getByText('10, 10')).toBeInTheDocument();
    });

    it('should show current segments from a preset', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [20, 10] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('20, 10')).toBeInTheDocument();
    });

    it('should display a custom value not in the preset list', () => {
      const onChange = jest.fn();
      render(
        <LineStyleEditor
          value={{ fill: 'dash', dash: [7, 3, 7] }}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getByText('7, 3, 7')).toBeInTheDocument();
    });
  });
});
