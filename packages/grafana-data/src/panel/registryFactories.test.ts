import {
  type StandardEditorContext,
  standardFieldConfigEditorRegistry,
} from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty, type FieldConfigPropertyItem } from '../types/fieldOverrides';

import { type SetFieldConfigOptionsArgs } from './PanelPlugin';
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

  describe('typing the editor context to the panel options', () => {
    interface Options {
      showUnit: boolean;
    }

    interface CustomConfig {
      lineWidth: number;
    }

    // The context options default to `any`, which would satisfy a plain property access even if the
    // type stopped being threaded through. Collapsing `any` to `never` makes these tests fail to
    // compile in that case, which is the regression they exist to catch.
    type NotAny<T> = 0 extends 1 & T ? never : T;

    it('types context.options for a standard property, so a showIf needs no cast', () => {
      const showIf = jest.fn().mockReturnValue(true);
      const config: SetFieldConfigOptionsArgs<CustomConfig, Options> = {
        standardOptions: {
          [FieldConfigProperty.Min]: {
            showIf: (defaults, _data, _annotations, ctx) => {
              const options: NotAny<NonNullable<typeof ctx>['options']> = ctx?.options;
              return showIf(defaults, options?.showUnit);
            },
          },
        },
      };

      const registry = createFieldConfigRegistry(config, 'Test');
      registry
        .getIfExists('min')
        ?.showIf?.({ min: 1 }, undefined, undefined, { data: [], options: { showUnit: true } });

      expect(showIf).toHaveBeenCalledWith({ min: 1 }, true);
    });

    it('types context.options for a custom property, so a showIf needs no cast', () => {
      const showIf = jest.fn().mockReturnValue(true);
      const config: SetFieldConfigOptionsArgs<CustomConfig, Options> = {
        useCustomConfig: (builder) => {
          // addCustomEditor rather than addNumberInput, so the test does not depend on the
          // standard editors registry being initialised
          builder.addCustomEditor({
            id: 'lineWidth',
            path: 'lineWidth',
            name: 'Line width',
            editor: jest.fn(),
            override: jest.fn(),
            process: (value) => value,
            shouldApply: () => true,
            showIf: (custom, _data, _annotations, ctx) => {
              const options: NotAny<NonNullable<typeof ctx>['options']> = ctx?.options;
              return showIf(custom.lineWidth, options?.showUnit);
            },
          });
        },
      };

      const registry = createFieldConfigRegistry(config, 'Test');
      registry
        .getIfExists('custom.lineWidth')
        ?.showIf?.({ lineWidth: 2 }, undefined, undefined, { data: [], options: { showUnit: false } });

      expect(showIf).toHaveBeenCalledWith(2, false);
    });
  });

  it('forwards the editor context to a plugin-supplied showIf', () => {
    const showIf = jest.fn().mockReturnValue(true);
    const context = { data: [], options: { showValues: true } } as StandardEditorContext<unknown, unknown>;

    const registry = createFieldConfigRegistry({ standardOptions: { [FieldConfigProperty.Min]: { showIf } } }, 'Test');
    registry.getIfExists('min')?.showIf?.({}, undefined, undefined, context);

    expect(showIf).toHaveBeenCalledWith({}, undefined, undefined, context);
  });
});
