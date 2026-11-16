import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TableCellDisplayMode, type TableImageCellOptions } from '@grafana/schema';

import { ImageCellOptionsEditor } from './ImageCellOptionsEditor';

function setup(cellOptions: Partial<TableImageCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <ImageCellOptionsEditor cellOptions={{ type: TableCellDisplayMode.Image, ...cellOptions }} onChange={onChange} />
  );
  return { onChange };
}

// the editor renders the alt-text input first, then the title-text input
const altInput = () => screen.getAllByRole('textbox')[0];
const titleInput = () => screen.getAllByRole('textbox')[1];

describe('ImageCellOptionsEditor', () => {
  it('seeds the inputs from existing alt and title values', () => {
    setup({ alt: 'existing alt', title: 'existing title' });
    expect(altInput()).toHaveValue('existing alt');
    expect(titleInput()).toHaveValue('existing title');
  });

  it('emits the typed alt text', async () => {
    const { onChange } = setup();
    await userEvent.type(altInput(), 'A');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alt: 'A' }));
  });

  it('emits the typed title text', async () => {
    const { onChange } = setup();
    await userEvent.type(titleInput(), 'B');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'B' }));
  });
});
