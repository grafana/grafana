import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type StandardEditorContext, type StandardEditorsRegistryItem } from '@grafana/data';

import { SpanNullsEditor } from './SpanNullsEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<boolean | number> = {
  id: 'spanNulls',
  name: 'Connect null values',
  editor: SpanNullsEditor,
};

describe('SpanNullsEditor', () => {
  describe('Radio selection', () => {
    it('should render with Always selected when value is true', () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={true} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /always/i })).toBeChecked();
    });

    it('should render with Threshold selected for a custom threshold value', () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={7200000} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /threshold/i })).toBeChecked();
    });
  });

  describe('onChange', () => {
    it('should call onChange with false when Never is selected', async () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={true} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /never/i }));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should call onChange with true when Always is selected', async () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={false} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /always/i }));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should call onChange with default 1h when Threshold is selected', async () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={false} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /threshold/i }));

      expect(onChange).toHaveBeenCalledWith(3600000);
    });
  });

  describe('Threshold input', () => {
    it('should not show threshold input when value is a boolean', () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={true} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.queryByPlaceholderText('Never')).not.toBeInTheDocument();
    });

    it('should show threshold input when value is a number', () => {
      const onChange = jest.fn();
      render(<SpanNullsEditor value={3600000} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByPlaceholderText('Never')).toBeInTheDocument();
    });
  });
});
