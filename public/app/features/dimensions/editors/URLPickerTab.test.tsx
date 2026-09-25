import { render, screen } from 'test/test-utils';

import { MediaType } from '../types';

import { URLPickerTab } from './URLPickerTab';

const renderTab = (props: Partial<React.ComponentProps<typeof URLPickerTab>> = {}) =>
  render(<URLPickerTab newValue="" setNewValue={jest.fn()} mediaType={MediaType.Icon} {...props} />);

describe('URLPickerTab', () => {
  it('reports typed input through setNewValue', async () => {
    const setNewValue = jest.fn();
    const { user } = renderTab({ setNewValue });

    await user.type(screen.getByRole('textbox'), 'x');

    expect(setNewValue).toHaveBeenCalledWith('x');
  });

  it('derives the short name from the file portion of the URL', () => {
    renderTab({ newValue: 'https://host/path/sunny.svg' });
    expect(screen.getByText('sunny')).toBeInTheDocument();
  });

  it('truncates a long file name to 20 characters with an ellipsis', () => {
    const longName = 'a'.repeat(30);
    renderTab({ newValue: `https://host/${longName}.svg` });
    expect(screen.getByText(`${'a'.repeat(20)}...`)).toBeInTheDocument();
  });

  it('renders an image preview (with alt text) for the Image media type', () => {
    renderTab({ newValue: 'https://host/photo.png', mediaType: MediaType.Image });
    expect(screen.getByAltText('Preview of the selected URL')).toBeInTheDocument();
  });
});
