import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

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

  it('calls onChange when the title is edited', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    function Controlled() {
      const [link, setLink] = useState<{ title: string; url: string; targetBlank?: boolean }>({
        title: '',
        url: '',
        targetBlank: false,
      });
      return (
        <DataLinkEditor
          {...defaultProps}
          value={link}
          onChange={(_index, next) => {
            onChange(next);
            setLink(next);
          }}
        />
      );
    }

    render(<Controlled />);
    const title = await screen.findByLabelText('Title');
    // Pin the Title to the CodeMirror contenteditable wiring — a plain <Input> would fail this.
    expect(title).toHaveAttribute('contenteditable', 'true');
    await user.click(title);
    await user.keyboard('abc');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'abc' })));
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
