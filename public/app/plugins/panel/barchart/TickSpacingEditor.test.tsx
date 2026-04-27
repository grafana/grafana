import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { StandardEditorContext, StandardEditorsRegistryItem } from '@grafana/data/field';

import { TickSpacingEditor } from './TickSpacingEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<number> = {
  id: 'xTickLabelSpacing',
  name: 'X-axis labels minimum spacing',
  editor: TickSpacingEditor,
};

function renderTickSpacingEditor(value: number, onChange: jest.Mock) {
  return render(<TickSpacingEditor value={value} onChange={onChange} context={mockContext} item={mockItem} />);
}

describe('TickSpacingEditor', () => {
  describe('Spacing selection', () => {
    it('renders with None selected when value is 0', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(0, onChange);

      const noneButton = screen.getByLabelText(/none/i);
      expect(noneButton).toBeChecked();
    });

    it('renders with None selected when value is undefined', () => {
      const onChange = jest.fn();
      // @ts-expect-error asserting behavior with invalid runtime value
      renderTickSpacingEditor(undefined, onChange);

      const noneButton = screen.getByLabelText(/none/i);
      expect(noneButton).toBeChecked();
    });

    it('renders with Small selected when value is 100', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(100, onChange);

      const smallButton = screen.getByLabelText(/small/i);
      expect(smallButton).toBeChecked();
    });

    it('renders with Medium selected when value is 200', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(200, onChange);

      const mediumButton = screen.getByLabelText(/medium/i);
      expect(mediumButton).toBeChecked();
    });

    it('renders with Large selected when value is 300', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(300, onChange);

      const largeButton = screen.getByLabelText(/large/i);
      expect(largeButton).toBeChecked();
    });

    it('calls onChange(0) when None is clicked', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(100, onChange);

      const noneButton = screen.getByLabelText(/none/i);
      await userEvent.click(noneButton);

      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('calls onChange(100) when Small is clicked', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(0, onChange);

      const smallButton = screen.getByLabelText(/small/i);
      await userEvent.click(smallButton);

      expect(onChange).toHaveBeenCalledWith(100);
    });

    it('calls onChange(200) when Medium is clicked', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(0, onChange);

      const mediumButton = screen.getByLabelText(/medium/i);
      await userEvent.click(mediumButton);

      expect(onChange).toHaveBeenCalledWith(200);
    });

    it('calls onChange(300) when Large is clicked', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(0, onChange);

      const largeButton = screen.getByLabelText(/large/i);
      await userEvent.click(largeButton);

      expect(onChange).toHaveBeenCalledWith(300);
    });
  });

  describe('RTL checkbox', () => {
    it('does not show RTL checkbox when value is 0', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(0, onChange);

      expect(screen.queryByLabelText(/rtl/i)).not.toBeInTheDocument();
    });

    it('shows RTL checkbox when value is 100', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(100, onChange);

      expect(screen.getByLabelText(/rtl/i)).toBeInTheDocument();
    });

    it('shows RTL checkbox when value is -100 (RTL mode)', () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(-100, onChange);

      expect(screen.getByLabelText(/rtl/i)).toBeInTheDocument();
    });

    it('calls onChange(-100) when RTL is toggled from 100', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(100, onChange);

      const rtlCheckbox = screen.getByLabelText(/rtl/i);
      await userEvent.click(rtlCheckbox);

      expect(onChange).toHaveBeenCalledWith(-100);
    });

    it('calls onChange(100) when RTL is toggled from -100', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(-100, onChange);

      const rtlCheckbox = screen.getByLabelText(/rtl/i);
      await userEvent.click(rtlCheckbox);

      expect(onChange).toHaveBeenCalledWith(100);
    });
  });

  describe('RTL + spacing change', () => {
    it('preserves RTL when changing spacing from Small to Medium', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(-100, onChange);

      const mediumButton = screen.getByLabelText(/medium/i);
      await userEvent.click(mediumButton);

      expect(onChange).toHaveBeenCalledWith(-200);
    });

    it('calls onChange with correct signed value when spacing changes in RTL mode', async () => {
      const onChange = jest.fn();
      renderTickSpacingEditor(-200, onChange);

      const largeButton = screen.getByLabelText(/large/i);
      await userEvent.click(largeButton);

      expect(onChange).toHaveBeenCalledWith(-300);
    });
  });
});
