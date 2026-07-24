import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { type NewThemeOptions } from '@grafana/data';

import { ExportTab } from './ExportTab';

const options: NewThemeOptions = {
  name: 'Custom',
  id: 'custom',
  colors: { mode: 'dark', primary: { main: '#ff0000' } },
};

describe('ExportTab', () => {
  it('renders the options as formatted JSON', () => {
    render(<ExportTab options={options} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(JSON.stringify(options, null, 2));
  });

  it('copies the JSON to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ExportTab options={options} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(options, null, 2)));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});
