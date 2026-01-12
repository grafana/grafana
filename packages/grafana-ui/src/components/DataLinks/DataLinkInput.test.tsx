import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import * as React from 'react';

import { DataLinkBuiltInVars, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { DataLinkInput } from './DataLinkInput';

const mockSuggestions: VariableSuggestion[] = [
  {
    value: DataLinkBuiltInVars.seriesName,
    label: '__series.name',
    documentation: 'Series name',
    origin: VariableOrigin.Series,
  },
  {
    value: DataLinkBuiltInVars.fieldName,
    label: '__field.name',
    documentation: 'Field name',
    origin: VariableOrigin.Field,
  },
  {
    value: 'myVar',
    label: 'myVar',
    documentation: 'Custom variable',
    origin: VariableOrigin.Template,
  },
];

describe('DataLinkInput', () => {
  it('renders with initial value', async () => {
    const onChange = jest.fn();
    render(
      <DataLinkInput value="https://grafana.com" onChange={onChange} suggestions={mockSuggestions} />
    );

    await waitFor(() => {
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
    });
  });

  it('renders with placeholder when value is empty', async () => {
    const onChange = jest.fn();
    const placeholder = 'Enter URL here';
    
    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} placeholder={placeholder} />);

    await waitFor(() => {
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-label', placeholder);
    });
  });

  it('calls onChange when value changes', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('test');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('shows suggestions menu when $ is typed', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('$');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('shows suggestions menu when = is typed', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('=');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('closes suggestions on Escape key', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('$');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('navigates suggestions with arrow keys', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('$');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');

    // Menu should still be visible
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('inserts variable on Enter key', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.keyboard('$');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // Should have called onChange with the inserted variable
    expect(onChange).toHaveBeenCalled();
  });

  it('updates when external value prop changes', async () => {
    const onChange = jest.fn();

    function TestWrapper({ initialValue }: { initialValue: string }) {
      const [value, setValue] = React.useState(initialValue);

      useEffect(() => {
        setValue(initialValue);
      }, [initialValue]);

      return <DataLinkInput value={value} onChange={onChange} suggestions={mockSuggestions} />;
    }

    const { rerender } = render(<TestWrapper initialValue="first" />);
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    rerender(<TestWrapper initialValue="second" />);
    
    await waitFor(() => {
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
    });
  });

  it('displays component with default placeholder', async () => {
    const onChange = jest.fn();
    
    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);

    await waitFor(() => {
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-label', 'http://your-grafana.com/d/000000010/annotations');
    });
  });
});
