import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataLink, VariableOrigin, VariableSuggestionsScope } from '@grafana/data';

import { DataLinksValueEditor } from './links';

type EditorItem = Parameters<typeof DataLinksValueEditor>[0]['item'];
const editorItem = { settings: {} } as EditorItem;

const makeLink = (title: string): DataLink => ({ title, url: 'https://grafana.com' });

describe('DataLinksValueEditor', () => {
  it('renders the links editor container and add button', () => {
    render(<DataLinksValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    expect(screen.getByTestId('links-inline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add link/i })).toBeInTheDocument();
  });

  it('displays existing link titles in the list', () => {
    const links: DataLink[] = [
      { title: 'Grafana Homepage', url: 'https://grafana.com' },
      { title: 'Docs', url: 'https://grafana.com/docs' },
    ];

    render(<DataLinksValueEditor value={links} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    expect(screen.getByText('Grafana Homepage')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });

  it('opens the add modal (without crashing) when context.getSuggestions is absent', async () => {
    render(<DataLinksValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    await userEvent.click(screen.getByRole('button', { name: /add link/i }));

    expect(screen.getByRole('dialog', { name: /add link/i })).toBeInTheDocument();
  });

  it('opens the edit modal (without crashing) when context.getSuggestions is absent', async () => {
    render(
      <DataLinksValueEditor value={[makeLink('Grafana Homepage')]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />
    );

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('dialog', { name: /edit link/i })).toBeInTheDocument();
  });

  it('calls getSuggestions with Values scope when the add modal opens', async () => {
    const suggestions = [{ value: '${__value.text}', label: 'Value', origin: VariableOrigin.Value }];
    const getSuggestions = jest.fn().mockReturnValue(suggestions);

    render(
      <DataLinksValueEditor value={[]} onChange={jest.fn()} context={{ data: [], getSuggestions }} item={editorItem} />
    );

    await userEvent.click(screen.getByRole('button', { name: /add link/i }));

    expect(screen.getByRole('dialog', { name: /add link/i })).toBeInTheDocument();
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });

  it('calls getSuggestions with Values scope when the edit modal opens', async () => {
    const suggestions = [{ value: '${__value.text}', label: 'Value', origin: VariableOrigin.Value }];
    const getSuggestions = jest.fn().mockReturnValue(suggestions);

    render(
      <DataLinksValueEditor
        value={[makeLink('Grafana Homepage')]}
        onChange={jest.fn()}
        context={{ data: [], getSuggestions }}
        item={editorItem}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('dialog', { name: /edit link/i })).toBeInTheDocument();
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });
});
