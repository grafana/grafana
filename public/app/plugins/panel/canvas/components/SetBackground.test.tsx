import { render, screen } from 'test/test-utils';

import { ResourceDimensionMode } from '@grafana/schema';
import { type Scene } from 'app/features/canvas/runtime/scene';

import { SetBackground } from './SetBackground';

const popoverLoadedOnImport = Boolean(
  require.cache[require.resolve('app/features/dimensions/editors/ResourcePickerPopover')]
);
const originalURL = 'https://example.com/original.png';
const selectedURL = 'https://example.com/selected.png';

function setup() {
  const onClose = jest.fn();
  const scene = {
    root: {
      options: {
        background: {
          color: { fixed: 'blue' },
          image: { mode: ResourceDimensionMode.Fixed, fixed: originalURL },
        },
      },
      reinitializeMoveable: jest.fn(),
    },
    revId: 4,
    save: jest.fn(),
    updateData: jest.fn(),
    data: { series: [] },
  };

  return {
    ...render(<SetBackground onClose={onClose} scene={scene as unknown as Scene} anchorPoint={{ x: 100, y: 300 }} />),
    scene,
    onClose,
  };
}

describe('SetBackground', () => {
  it('loads the shared popover on render and applies the selected image to the scene', async () => {
    expect(popoverLoadedOnImport).toBe(false);
    const { user, scene, onClose } = setup();
    const input = await screen.findByRole('textbox');
    expect(input).toHaveValue(originalURL);

    await user.clear(input);
    await user.type(input, selectedURL);
    expect(screen.getByRole('img', { name: 'Preview of the selected URL' })).toHaveAttribute('src', selectedURL);
    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(scene.root.options.background).toEqual({
      color: { fixed: 'blue' },
      image: { mode: ResourceDimensionMode.Fixed, fixed: selectedURL },
    });
    expect(scene.revId).toBe(5);
    expect(scene.save).toHaveBeenCalledTimes(1);
    expect(scene.root.reinitializeMoveable).toHaveBeenCalledTimes(1);
    expect(scene.updateData).toHaveBeenCalledWith(scene.data);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the original background and closes when an edited URL is cancelled', async () => {
    const { user, scene, onClose } = setup();
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, selectedURL);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(scene.root.options.background.image).toEqual({
      mode: ResourceDimensionMode.Fixed,
      fixed: originalURL,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
