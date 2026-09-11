import {
  type StandardEditorContext,
  standardFieldConfigEditorRegistry,
} from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty, type FieldConfigPropertyItem } from '../types/fieldOverrides';

import { createFieldConfigRegistry } from './registryFactories';

describe('createFieldConfigRegistry', () => {
  // `max` ships a showIf of its own, like fieldMinMax does in core, so we can check what a
  // plugin-supplied showIf does to it.
  const builtInShowIf = () => true;

  beforeAll(() => {
    standardFieldConfigEditorRegistry.setInit(
      () =>
        [
          { id: FieldConfigProperty.Min, path: 'min' },
          { id: FieldConfigProperty.Max, path: 'max', showIf: builtInShowIf },
        ] as FieldConfigPropertyItem[]
    );
  });

  it('attaches a plugin-supplied showIf to a standard property', () => {
    const showIf = jest.fn().mockReturnValue(false);

    const registry = createFieldConfigRegistry({ standardOptions: { [FieldConfigProperty.Min]: { showIf } } }, 'Test');

    expect(registry.getIfExists('min')?.showIf).toBe(showIf);
  });

  it('leaves properties the plugin did not configure alone', () => {
    const registry = createFieldConfigRegistry(
      { standardOptions: { [FieldConfigProperty.Min]: { showIf: jest.fn() } } },
      'Test'
    );

    expect(registry.getIfExists('max')?.showIf).toBe(builtInShowIf);
  });

  it("replaces a property's own showIf, so a plugin can force it visible", () => {
    const showIf = jest.fn().mockReturnValue(true);

    const registry = createFieldConfigRegistry({ standardOptions: { [FieldConfigProperty.Max]: { showIf } } }, 'Test');

    expect(registry.getIfExists('max')?.showIf).toBe(showIf);
  });

  it('keeps the built-in showIf when only other settings are overridden', () => {
    const registry = createFieldConfigRegistry(
      { standardOptions: { [FieldConfigProperty.Max]: { defaultValue: 10 } } },
      'Test'
    );

    expect(registry.getIfExists('max')?.showIf).toBe(builtInShowIf);
    expect(registry.getIfExists('max')?.defaultValue).toBe(10);
  });

  it('does not leak a plugin showIf into other plugins via the shared standard registry', () => {
    createFieldConfigRegistry({ standardOptions: { [FieldConfigProperty.Min]: { showIf: jest.fn() } } }, 'Test');

    const otherPlugin = createFieldConfigRegistry({}, 'Other');

    expect(otherPlugin.getIfExists('min')?.showIf).toBeUndefined();
  });

  it('forwards the editor context to a plugin-supplied showIf', () => {
    const showIf = jest.fn().mockReturnValue(true);
    const context = { data: [], options: { showValues: true } } as StandardEditorContext<unknown, unknown>;

    const registry = createFieldConfigRegistry({ standardOptions: { [FieldConfigProperty.Min]: { showIf } } }, 'Test');
    registry.getIfExists('min')?.showIf?.({}, undefined, undefined, context);

    expect(showIf).toHaveBeenCalledWith({}, undefined, undefined, context);
  });
});
