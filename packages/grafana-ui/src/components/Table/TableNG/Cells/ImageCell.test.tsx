import { render, screen, fireEvent } from '@testing-library/react';

import { type Field, FieldType } from '@grafana/data';

import { TableCellDisplayMode } from '../../types';

import { ImageCell } from './ImageCell';

const makeField = (url: string): Field => ({
  name: 'image',
  type: FieldType.string,
  values: [url],
  config: {},
  display: () => ({ text: url, numeric: 0, color: undefined }),
});

const baseCellOptions = {
  type: TableCellDisplayMode.Image as const,
};

describe('ImageCell', () => {
  it('renders an img element with the correct src when the URL is valid', () => {
    const url = 'https://example.com/image.png';
    render(<ImageCell cellOptions={baseCellOptions} field={makeField(url)} value={url} rowIdx={0} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', url);
  });

  it('renders the configured alt text on the img element', () => {
    const url = 'https://example.com/image.png';
    const cellOptions = { ...baseCellOptions, alt: 'My alt text' };
    render(<ImageCell cellOptions={cellOptions} field={makeField(url)} value={url} rowIdx={0} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'My alt text');
  });

  it('renders configured alt text instead of the raw URL when the image fails to load', () => {
    const url = 'https://example.com/broken.png';
    const cellOptions = { ...baseCellOptions, alt: 'Broken image alt' };
    render(<ImageCell cellOptions={cellOptions} field={makeField(url)} value={url} rowIdx={0} />);

    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Broken image alt')).toBeInTheDocument();
    expect(screen.queryByText(url)).not.toBeInTheDocument();
  });

  it('falls back to the raw URL when the image fails to load and no alt text is configured', () => {
    const url = 'https://example.com/broken.png';
    render(<ImageCell cellOptions={baseCellOptions} field={makeField(url)} value={url} rowIdx={0} />);

    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(url)).toBeInTheDocument();
  });

  it('renders nothing when the field display text is empty', () => {
    const field: Field = {
      name: 'image',
      type: FieldType.string,
      values: [''],
      config: {},
      display: () => ({ text: '', numeric: 0, color: undefined }),
    };
    const { container } = render(<ImageCell cellOptions={baseCellOptions} field={field} value="" rowIdx={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
