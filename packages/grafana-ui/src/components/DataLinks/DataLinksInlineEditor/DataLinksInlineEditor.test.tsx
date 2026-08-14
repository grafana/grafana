import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataLinksInlineEditor } from './DataLinksInlineEditor';

describe('DataLinksInlineEditor', () => {
  it('renders existing links and add button', () => {
    render(
      <DataLinksInlineEditor
        links={[{ title: 'My Link', url: '/link' }]}
        onChange={jest.fn()}
        data={[]}
        getSuggestions={() => []}
      />
    );

    expect(screen.getByText('My Link')).toBeInTheDocument();
    expect(screen.getByText('Add link')).toBeInTheDocument();
  });

  it('opens modal with editor content on add', async () => {
    render(<DataLinksInlineEditor onChange={jest.fn()} data={[]} getSuggestions={() => []} />);

    await userEvent.click(screen.getByText('Add link'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});
