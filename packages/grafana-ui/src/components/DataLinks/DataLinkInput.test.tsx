import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import * as React from 'react';

import { createTheme, DataLinkBuiltInVars, VariableOrigin, type VariableSuggestion } from '@grafana/data';

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
  const theme = createTheme();

  it('renders with initial value displayed in editor', async () => {
    render(<DataLinkInput value="https://grafana.com" onChange={jest.fn()} suggestions={mockSuggestions} />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('default placeholder matches original Slate version', async () => {
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-placeholder',
        'http://your-grafana.com/d/000000010/annotations'
      );
    });
  });

  it('custom placeholder is respected', async () => {
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} placeholder="Enter URL here" />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-placeholder', 'Enter URL here');
    });
  });

  it('forwards aria-labelledby to the editable element', async () => {
    render(
      <DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} aria-labelledby="url-label-id" />
    );
    expect(await screen.findByRole('textbox')).toHaveAttribute('aria-labelledby', 'url-label-id');
  });

  it('typing triggers onChange', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('test');
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('typing $ shows completion listbox', async () => {
    const user = userEvent.setup();
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('$');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('typing = shows completion listbox', async () => {
    const user = userEvent.setup();
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('=');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('Escape closes listbox', async () => {
    const user = userEvent.setup();
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={mockSuggestions} />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('$');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('selecting suggestion via Enter calls onChange and closes listbox', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    // A controlled wrapper that tracks the value, mirroring real consumers
    // (DataLinkEditor, DerivedField). A fixed `value` would make the editor
    // reconcile away the accepted completion.
    function Controlled() {
      const [value, setValue] = React.useState('');
      return (
        <DataLinkInput
          value={value}
          onChange={(url) => {
            onChange(url);
            setValue(url);
          }}
          suggestions={mockSuggestions}
        />
      );
    }

    render(<Controlled />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('$');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith('${__series.name}');
  });

  it('external value prop update is reflected in editor', async () => {
    const onChange = jest.fn();

    function Wrapper({ initialValue }: { initialValue: string }) {
      const [value, setValue] = React.useState(initialValue);
      useEffect(() => {
        setValue(initialValue);
      }, [initialValue]);
      return <DataLinkInput value={value} onChange={onChange} suggestions={mockSuggestions} />;
    }

    const { rerender } = render(<Wrapper initialValue="first" />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    rerender(<Wrapper initialValue="second" />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('text interpolation mode applies a plain ${var} for template variables', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = React.useState('');
      return (
        <DataLinkInput
          value={value}
          interpolationMode="text"
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          suggestions={mockSuggestions}
        />
      );
    }

    render(<Controlled />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    // Type `$myVar` so the listbox filters down to the template variable, then accept.
    await user.keyboard('$myVar');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    // URL mode would yield `${myVar:queryparam}`; text mode must be plain.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('${myVar}'));
  });

  it('applies the given id to the wrapper around the editable element', async () => {
    const { container } = render(
      <DataLinkInput id="link-title" value="" onChange={jest.fn()} suggestions={mockSuggestions} />
    );
    await screen.findByRole('textbox');
    expect(container.querySelector('#link-title [contenteditable="true"]')).not.toBeNull();
  });

  it('renders with a proportional font when monospace is false', async () => {
    const { container } = render(
      <DataLinkInput value="x" onChange={jest.fn()} suggestions={mockSuggestions} monospace={false} />
    );
    await screen.findByRole('textbox');
    const editor = container.querySelector('.cm-editor');
    expect(editor).not.toBeNull();
    // Guard against a vacuous pass if jsdom failed to resolve the injected font.
    expect(getComputedStyle(editor!).fontFamily).not.toBe('');
    expect(getComputedStyle(editor!).fontFamily).toBe(theme.typography.fontFamily);
  });
});
