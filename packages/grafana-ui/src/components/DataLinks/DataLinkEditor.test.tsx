import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataLinkEditor } from './DataLinkEditor';

const defaultProps = {
  index: 0,
  isLast: false,
  value: { title: 'My Title', url: 'http://example.com', targetBlank: false },
  suggestions: [],
  onChange: jest.fn(),
};

describe('DataLinkEditor', () => {
  it('renders title, URL, and open-in-new-tab fields', async () => {
    render(<DataLinkEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    expect(screen.getByText('URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Open in new tab')).toBeInTheDocument();
  });

  it('calls onChange when title is changed', async () => {
    const onChange = jest.fn();
    render(<DataLinkEditor {...defaultProps} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Title'), '!');

    expect(onChange).toHaveBeenCalledWith(0, expect.objectContaining({ title: 'My Title!' }));
  });

  it('calls onChange when open in new tab is toggled', async () => {
    const onChange = jest.fn();
    render(<DataLinkEditor {...defaultProps} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Open in new tab')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('Open in new tab'));

    expect(onChange).toHaveBeenCalledWith(0, expect.objectContaining({ targetBlank: true }));
  });

  it('shows one-click switch when showOneClick is true', async () => {
    render(<DataLinkEditor {...defaultProps} showOneClick />);

    await waitFor(() => {
      expect(screen.getByText('One click')).toBeInTheDocument();
    });
  });

  it('hides one-click switch by default', async () => {
    render(<DataLinkEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    expect(screen.queryByText('One click')).not.toBeInTheDocument();
  });

  it('shows info text when isLast is true', async () => {
    render(<DataLinkEditor {...defaultProps} isLast />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    expect(screen.getByText(/Type CMD\+Space/)).toBeInTheDocument();
  });
});
