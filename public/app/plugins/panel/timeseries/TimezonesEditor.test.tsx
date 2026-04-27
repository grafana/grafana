import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import selectEvent from 'react-select-event';

import type { StandardEditorContext, StandardEditorsRegistryItem } from '@grafana/data/field';
import { type OptionsWithTimezones } from '@grafana/schema';

import { TimezonesEditor } from './TimezonesEditor';

const mockContext: StandardEditorContext<OptionsWithTimezones> = {
  data: [],
};

const mockItem: StandardEditorsRegistryItem<string[]> = {
  id: 'timezones',
  name: 'Time zones',
  editor: TimezonesEditor,
};

describe('TimezonesEditor', () => {
  describe('Rendering', () => {
    it('should render a single timezone picker when value is undefined', () => {
      const onChange = jest.fn();
      render(<TimezonesEditor value={undefined!} onChange={onChange} context={mockContext} item={mockItem} />);

      expect(screen.getAllByRole('combobox')).toHaveLength(1);
    });

    it('should render a picker per entry with add and remove buttons', () => {
      const onChange = jest.fn();
      render(
        <TimezonesEditor
          value={['utc', 'America/New_York']}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      expect(screen.getAllByRole('combobox')).toHaveLength(2);
      expect(screen.getByRole('button', { name: /remove timezone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add timezone/i })).toBeInTheDocument();
    });
  });

  describe('Add and remove', () => {
    it('should call onChange with an appended default timezone when add is clicked', async () => {
      const onChange = jest.fn();
      render(<TimezonesEditor value={['utc']} onChange={onChange} context={mockContext} item={mockItem} />);

      await userEvent.click(screen.getByRole('button', { name: /add timezone/i }));

      expect(onChange).toHaveBeenCalledWith(['utc', '']);
    });

    it('should call onChange with the timezone removed when remove is clicked', async () => {
      const onChange = jest.fn();
      render(
        <TimezonesEditor
          value={['utc', 'America/New_York', 'Europe/London']}
          onChange={onChange}
          context={mockContext}
          item={mockItem}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: /remove timezone/i });
      await userEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith(['America/New_York', 'Europe/London']);
    });
  });

  describe('Set timezone', () => {
    it('should call onChange with updated array when a timezone is changed', async () => {
      const onChange = jest.fn();
      render(<TimezonesEditor value={['utc']} onChange={onChange} context={mockContext} item={mockItem} />);

      const picker = screen.getByRole('combobox');
      await selectEvent.select(picker, 'Browser Time', { container: document.body });

      expect(onChange).toHaveBeenCalledWith(['browser']);
    });

    it('should call onChange with undefined when the only timezone is cleared', async () => {
      const onChange = jest.fn();
      render(<TimezonesEditor value={['utc']} onChange={onChange} context={mockContext} item={mockItem} />);

      const picker = screen.getByRole('combobox');
      await selectEvent.select(picker, 'Default', { container: document.body });

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });
});
