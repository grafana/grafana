import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { StandardEditorContext, StandardEditorsRegistryItem } from '@grafana/data/field';

import { InsertNullsEditor } from './InsertNullsEditor';

const mockContext: StandardEditorContext<unknown> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<boolean | number> = {
  id: 'insertNulls',
  name: 'Disconnect values',
  editor: InsertNullsEditor,
};

describe('InsertNullsEditor', () => {
  describe('Disconnect option selection', () => {
    it('should render with Never selected when value is false', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /never/i })).toBeChecked();
    });

    it('should render with Threshold selected for a custom threshold value', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={7200000} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('radio', { name: /threshold/i })).toBeChecked();
    });

    it('should call onChange with false when Never is selected', async () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /never/i }));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should call onChange with default 1h threshold when Threshold is selected', async () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('radio', { name: /threshold/i }));

      expect(onChange).toHaveBeenCalledWith(3600000);
    });
  });

  describe('Threshold input', () => {
    it('should not show threshold input when value is false', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={false} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should show threshold input when value is a number', () => {
      const onChange = jest.fn();
      render(<InsertNullsEditor value={3600000} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
