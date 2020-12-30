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
      useCustomConfig: b => {
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
      useCustomConfig: b => {
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
});
