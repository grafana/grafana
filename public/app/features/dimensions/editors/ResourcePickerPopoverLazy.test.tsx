import { type ComponentProps } from 'react';
import { of } from 'rxjs';
import { render, screen, waitFor, within } from 'test/test-utils';

import { MediaType, ResourceFolderName, ResourcePickerSize } from '../types';

import { ResourcePicker } from './ResourcePicker';

// Capture import-time loading before any test opens the shared lazy component.
const popoverLoadedOnImport = Boolean(require.cache[require.resolve('./ResourcePickerPopover')]);
const mockListFiles = jest.fn(() => of([]));

jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  ...jest.requireActual('app/plugins/datasource/grafana/datasource'),
  getGrafanaDatasource: () => Promise.resolve({ listFiles: mockListFiles }),
}));

const originalURL = 'https://example.com/original.png';
const selectedURL = 'https://example.com/selected.png';

function setup(props: Partial<ComponentProps<typeof ResourcePicker>> = {}) {
  const onChange = jest.fn();
  return {
    ...render(
      <ResourcePicker
        onChange={onChange}
        mediaType={MediaType.Image}
        folderName={ResourceFolderName.BG}
        size={ResourcePickerSize.NORMAL}
        value={originalURL}
        src="img/icons/unicons/image.svg"
        name="original.png"
        {...props}
      />
    ),
    onChange,
  };
}

describe('lazy resource picker popover', () => {
  it('keeps the trigger and preview eager, then loads the popover to select a URL', async () => {
    const { user, onChange } = setup();

    expect(screen.getByRole('textbox')).toHaveValue('original.png');
    // The shared react-inlinesvg mock uses the source URL as the SVG id.
    expect(document.getElementById('img/icons/unicons/image.svg')).toBeInTheDocument();
    expect(popoverLoadedOnImport).toBe(false);
    expect(require.cache[require.resolve('./ResourcePickerPopover')]).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('textbox'));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('textbox');
    expect(input).toHaveValue(originalURL);

    await user.clear(input);
    await user.type(input, selectedURL);
    expect(within(dialog).getByRole('img', { name: 'Preview of the selected URL' })).toHaveAttribute(
      'src',
      selectedURL
    );
    await user.click(within(dialog).getByRole('button', { name: 'Select' }));

    expect(onChange.mock.calls).toEqual([[selectedURL]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox')).toHaveValue('original.png');
  });

  it('discards a draft on cancel and starts with the current value when reopened', async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole('textbox'));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('textbox');
    await user.clear(input);
    await user.type(input, selectedURL);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onChange.mock.calls).toEqual([[originalURL]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('textbox'));
    const reopenedDialog = await screen.findByRole('dialog');
    expect(within(reopenedDialog).getByRole('textbox')).toHaveValue(originalURL);
  });

  it('opens the small picker with Enter, forwards folder options, and dismisses with Escape', async () => {
    const { user, onChange } = setup({
      value: undefined,
      src: undefined,
      size: ResourcePickerSize.SMALL,
      mediaType: MediaType.Icon,
      folderName: ResourceFolderName.Marker,
      maxFiles: 25,
    });

    const trigger = screen.getByRole('button', { name: 'Set icon' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Folder' })).toHaveValue(ResourceFolderName.Marker);
    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Marker, 25));
    await user.click(within(dialog).getByRole('button', { name: 'URL' }));
    expect(within(dialog).getByRole('textbox')).toHaveValue('');
    await user.keyboard('{Escape}');

    expect(onChange.mock.calls).toEqual([[undefined]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
