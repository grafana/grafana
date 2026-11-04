import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TableCellDisplayMode, type TableImageCellOptions } from '@grafana/schema';

import { ImageCellOptionsEditor } from './ImageCellOptionsEditor';

function setup(cellOptions: Partial<TableImageCellOptions> = {}, searchQuery?: string) {
  const onChange = jest.fn();
  const { container } = render(
    <ImageCellOptionsEditor
      cellOptions={{ type: TableCellDisplayMode.Image, ...cellOptions }}
      onChange={onChange}
      searchQuery={searchQuery}
    />
  );
  return { onChange, container };
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

  it.each([undefined, 'alt', 'unmatched'])('preserves field semantics while searching for %s', (searchQuery) => {
    const { container } = setup({}, searchQuery);

    expect(
      screen.getByText(
        "Alternative text that will be displayed if an image can't be displayed or for users who use a screen reader"
      )
    ).toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /Alt text/ });
    expect(input).toHaveAccessibleName(/Alt text.*Alternative text/);
    const label = container.querySelector(`label[for="${input.id}"]`);
    expect(label).toHaveAttribute('for', input.id);
    expect(label?.querySelectorAll('label')).toHaveLength(0);
    if (searchQuery === 'alt') {
      expect(label?.querySelector('mark')).toHaveTextContent('Alt');
    } else {
      expect(label?.querySelector('mark')).not.toBeInTheDocument();
    }
    expect(container.querySelectorAll('label')).toHaveLength(2);
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
