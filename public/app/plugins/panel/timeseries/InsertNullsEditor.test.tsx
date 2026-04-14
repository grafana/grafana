import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type StandardEditorContext, type StandardEditorsRegistryItem } from '@grafana/data';

import { InsertNullsEditor } from './InsertNullsEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

function makeItem(isTime?: boolean): StandardEditorsRegistryItem<boolean | number> {
  return {
    id: 'insertNulls',
    name: 'Disconnect values',
    editor: InsertNullsEditor,
    settings: isTime !== undefined ? { isTime } : undefined,
  };
}

describe('InsertNullsEditor', () => {
  describe('Disconnect option selection', () => {
    it('should render with Never selected when value is false', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={makeItem()} />);

      const neverButton = screen.getByRole('radio', { name: /never/i });
      expect(neverButton).toBeChecked();
    });

    it('should render with Threshold selected when value is a number', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={makeItem()} />);

      const thresholdButton = screen.getByRole('radio', { name: /threshold/i });
      expect(thresholdButton).toBeChecked();
    });

    it('should call onChange with false when Never is selected', async () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={makeItem()} />);

      const neverButton = screen.getByRole('radio', { name: /never/i });
      await userEvent.click(neverButton);

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should call onChange with default 1h threshold when Threshold is selected', async () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={makeItem()} />);

      const thresholdButton = screen.getByRole('radio', { name: /threshold/i });
      await userEvent.click(thresholdButton);

      expect(onChange).toHaveBeenCalledWith(3600000);
    });

    it('should preserve custom threshold value in the Threshold option', () => {
      const onChange = jest.fn();
      const customMs = 7200000; // 2h
      render(<InsertNullsEditor value={customMs} onChange={onChange} context={mockContext} item={makeItem()} />);

      const thresholdButton = screen.getByRole('radio', { name: /threshold/i });
      expect(thresholdButton).toBeChecked();
    });
  });

  describe('Threshold input visibility', () => {
    it('should not show threshold input when value is false', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={makeItem()} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should show threshold input when value is a number', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={makeItem()} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should show ">" prefix in the threshold input', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={makeItem()} />);

      expect(screen.getByText('>')).toBeInTheDocument();
    });
  });

  describe('Threshold input behavior', () => {
    it('should format value as duration when isTime is true', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={makeItem(true)} />);

      expect(screen.getByRole('textbox')).toHaveValue('1h');
    });

    it('should default to raw number when isTime is false', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={1000} onChange={onChange} context={mockContext} item={makeItem(false)} />);

      expect(screen.getByRole('textbox')).toHaveValue('10');
    });
  });
});
