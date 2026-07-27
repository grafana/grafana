import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type VariableSuggestion, VariableOrigin } from '@grafana/data';

import { DataLinkSuggestions } from './DataLinkSuggestions';

const suggestions: VariableSuggestion[] = [
  { value: '__data.fields.name', label: 'Name', documentation: 'Field name', origin: VariableOrigin.Fields },
  { value: '__data.fields.value', label: 'Value', documentation: 'Field value', origin: VariableOrigin.Fields },
  { value: '__series.name', label: 'Series name', documentation: 'Series name', origin: VariableOrigin.Series },
];

describe('DataLinkSuggestions', () => {
  it('renders suggestions grouped by origin', () => {
    render(<DataLinkSuggestions suggestions={suggestions} activeIndex={0} onSuggestionSelect={jest.fn()} />);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Series name')).toBeInTheDocument();
  });

  it('calls onSuggestionSelect when a suggestion is clicked', async () => {
    const onSelect = jest.fn();
    render(<DataLinkSuggestions suggestions={suggestions} activeIndex={0} onSuggestionSelect={onSelect} />);

    await userEvent.click(screen.getByText('Value'));

    expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
  });

  it('renders empty when no suggestions provided', () => {
    render(<DataLinkSuggestions suggestions={[]} activeIndex={0} onSuggestionSelect={jest.fn()} />);

    expect(screen.getByRole('menu')).toBeEmptyDOMElement();
  });
});
