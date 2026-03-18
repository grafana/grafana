import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import * as React from 'react';

import { DataLinkBuiltInVars, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { DataLinkInput } from './DataLinkInput';

// Mock getClientRects for CodeMirror in JSDOM
beforeAll(() => {
  Range.prototype.getClientRects = jest.fn(() => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: jest.fn(),
  }));
  Range.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    toJSON: () => {},
  }));
});

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
    render(<DataLinkInput value="" onChange={onChange} suggestions={mockSuggestions} />);
    await screen.findByRole('textbox');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('$');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
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
});
