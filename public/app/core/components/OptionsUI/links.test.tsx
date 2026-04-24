import { render, screen } from '@testing-library/react';

import { type DataLink } from '@grafana/data';

import { DataLinksValueEditor } from './links';

type EditorItem = Parameters<typeof DataLinksValueEditor>[0]['item'];
const editorItem = { settings: {} } as EditorItem;

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

  it('renders without crashing when context.getSuggestions is absent', () => {
    render(<DataLinksValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    expect(screen.getByTestId('links-inline')).toBeInTheDocument();
  });
});
