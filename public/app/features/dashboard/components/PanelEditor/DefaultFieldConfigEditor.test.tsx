import React from 'react';
import { render } from '@testing-library/react';
import { DefaultFieldConfigEditor } from './DefaultFieldConfigEditor';
import {
  FieldConfigEditorConfig,
  FieldConfigSource,
  PanelPlugin,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { mockStandardFieldConfigOptions } from '../../../../../test/helpers/fieldConfig';
import { selectors } from '@grafana/e2e-selectors';

interface FakeFieldOptions {
  a: boolean;
  b: string;
  c: boolean;
}

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());

const fieldConfigMock: FieldConfigSource<FakeFieldOptions> = {
  defaults: {
    custom: {
      a: true,
      b: 'test',
      c: true,
    },
  },
  overrides: [],
};

describe('DefaultFieldConfigEditor', () => {
  it('should render custom  options', () => {
    const plugin = new PanelPlugin(() => null).useFieldConfig({
      standardOptions: {},
      useCustomConfig: (b) => {
        b.addBooleanSwitch({
          name: 'a',
          path: 'a',
        } as FieldConfigEditorConfig<FakeFieldOptions>)
          .addBooleanSwitch({
            name: 'c',
            path: 'c',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
          .addTextInput({
            name: 'b',
            path: 'b',
          } as FieldConfigEditorConfig<FakeFieldOptions>);
      },
    });

    const { queryAllByLabelText } = render(
      <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
    );

    const editors = queryAllByLabelText(selectors.components.PanelEditor.FieldOptions.propertyEditor('Custom'));
    expect(editors).toHaveLength(3);
  });

  it('should not render options that are marked as hidden from defaults', () => {
    const plugin = new PanelPlugin(() => null).useFieldConfig({
      standardOptions: {},
      useCustomConfig: (b) => {
        b.addBooleanSwitch({
          name: 'a',
          path: 'a',
          hideFromDefaults: true,
        } as FieldConfigEditorConfig<FakeFieldOptions>)
          .addBooleanSwitch({
            name: 'c',
            path: 'c',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
          .addTextInput({
            name: 'b',
            path: 'b',
          } as FieldConfigEditorConfig<FakeFieldOptions>);
      },
    });

    const { queryAllByLabelText } = render(
      <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
    );

    const editors = queryAllByLabelText(selectors.components.PanelEditor.FieldOptions.propertyEditor('Custom'));
    expect(editors).toHaveLength(2);
  });

  describe('categories', () => {
    it('should render uncategorized options under panel category', () => {
      const plugin = new PanelPlugin(() => null).useFieldConfig({
        standardOptions: {},
        useCustomConfig: (b) => {
          b.addBooleanSwitch({
            name: 'a',
            path: 'a',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'c',
              path: 'c',
            } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addTextInput({
              name: 'b',
              path: 'b',
            } as FieldConfigEditorConfig<FakeFieldOptions>);
        },
      });
      plugin.meta.name = 'Test plugin';

      const { queryAllByLabelText } = render(
        <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
      );

      expect(
        queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${plugin.meta.name} options/0`))
      ).toHaveLength(1);

      expect(queryAllByLabelText(selectors.components.OptionsGroup.toggle(), { exact: false })).toHaveLength(1);
    });

    it('should render categorized options under custom category', () => {
      const CATEGORY_NAME = 'Cat1';
      const plugin = new PanelPlugin(() => null).useFieldConfig({
        standardOptions: {},
        useCustomConfig: (b) => {
          b.addTextInput({
            name: 'b',
            path: 'b',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'a',
              path: 'a',
              category: [CATEGORY_NAME],
            } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'c',
              path: 'c',
              category: [CATEGORY_NAME],
            } as FieldConfigEditorConfig<FakeFieldOptions>);
        },
      });
      plugin.meta.name = 'Test plugin';

      const { queryAllByLabelText } = render(
        <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
      );

      expect(
        queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${plugin.meta.name} options/0`))
      ).toHaveLength(1);

      expect(queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${CATEGORY_NAME}/1`))).toHaveLength(1);

      expect(queryAllByLabelText(selectors.components.OptionsGroup.toggle(), { exact: false })).toHaveLength(2);
    });

    it('should allow subcategories in panel category', () => {
      const SUBCATEGORY_NAME = 'Sub1';
      const plugin = new PanelPlugin(() => null).useFieldConfig({
        standardOptions: {},
        useCustomConfig: (b) => {
          b.addTextInput({
            name: 'b',
            path: 'b',
            category: [undefined, SUBCATEGORY_NAME],
          } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'a',
              path: 'a',
            } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'c',
              path: 'c',
            } as FieldConfigEditorConfig<FakeFieldOptions>);
        },
      });
      plugin.meta.name = 'Test plugin';

      const { queryAllByLabelText, queryAllByText } = render(
        <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
      );

      expect(
        queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${plugin.meta.name} options/0`))
      ).toHaveLength(1);

      expect(queryAllByText(SUBCATEGORY_NAME, { exact: false })).toHaveLength(1);
    });

    it('should allow subcategories in custom category', () => {
      const CATEGORY_NAME = 'Cat1';
      const SUBCATEGORY_NAME = 'Sub1';
      const plugin = new PanelPlugin(() => null).useFieldConfig({
        standardOptions: {},
        useCustomConfig: (b) => {
          b.addBooleanSwitch({
            name: 'a',
            path: 'a',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'c',
              path: 'c',
            } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addTextInput({
              name: 'b',
              path: 'b',
              category: [CATEGORY_NAME, SUBCATEGORY_NAME],
            } as FieldConfigEditorConfig<FakeFieldOptions>);
        },
      });
      plugin.meta.name = 'Test plugin';

      const { queryAllByLabelText, queryAllByText } = render(
        <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
      );

      expect(
        queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${plugin.meta.name} options/0`))
      ).toHaveLength(1);
      expect(queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${CATEGORY_NAME}/1`))).toHaveLength(1);

      expect(queryAllByText(SUBCATEGORY_NAME, { exact: false })).toHaveLength(1);
    });

    it('should not render categories with hidden fields only', () => {
      const CATEGORY_NAME = 'Cat1';
      const SUBCATEGORY_NAME = 'Sub1';
      const plugin = new PanelPlugin(() => null).useFieldConfig({
        standardOptions: {},
        useCustomConfig: (b) => {
          b.addBooleanSwitch({
            name: 'a',
            path: 'a',
          } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addBooleanSwitch({
              name: 'c',
              path: 'c',
            } as FieldConfigEditorConfig<FakeFieldOptions>)
            .addTextInput({
              name: 'b',
              path: 'b',
              hideFromDefaults: true,
              category: [CATEGORY_NAME, SUBCATEGORY_NAME],
            } as FieldConfigEditorConfig<FakeFieldOptions>);
        },
      });
      plugin.meta.name = 'Test plugin';

      const { queryAllByLabelText, queryAllByText } = render(
        <DefaultFieldConfigEditor data={[]} onChange={jest.fn()} plugin={plugin} config={fieldConfigMock} />
      );

      expect(
        queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${plugin.meta.name} options/0`))
      ).toHaveLength(1);

      expect(queryAllByLabelText(selectors.components.OptionsGroup.toggle(`${CATEGORY_NAME}/1`))).toHaveLength(0);

      expect(queryAllByText(SUBCATEGORY_NAME, { exact: false })).toHaveLength(0);
    });
  });
});
