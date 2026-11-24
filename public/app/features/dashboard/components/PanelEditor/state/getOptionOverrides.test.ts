import {
  type FieldConfigPropertyItem,
  type FieldConfigSource,
  numberOverrideProcessor,
  standardEditorsRegistry,
} from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { getVarMappingOptionOverrides } from './getOptionOverrides';

standardEditorsRegistry.setInit(getAllOptionEditors);

const option = (id: string) => ({ id }) as FieldConfigPropertyItem;
const numberOption = (id: string, editorId = 'number') =>
  ({
    id,
    process: numberOverrideProcessor,
    editor: standardEditorsRegistry.get(editorId).editor,
  }) as FieldConfigPropertyItem;
const textOption = (id: string) => ({ id, settings: { expandTemplateVars: true } }) as FieldConfigPropertyItem;

describe('getVarMappingOptionOverrides', () => {
  it('marks an option mapped in the defaults', () => {
    const fieldConfig: FieldConfigSource = { defaults: { varMappings: { min: '$min' } }, overrides: [] };

    expect(getVarMappingOptionOverrides(numberOption('min'), fieldConfig)).toEqual([
      expect.objectContaining({ type: 'variable', tooltip: 'This option uses variables' }),
    ]);
    expect(getVarMappingOptionOverrides(numberOption('max'), fieldConfig)).toEqual([]);
  });

  it('marks an option mapped in an override rule', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'varMappings.min', value: '$min' }] }],
    };

    expect(getVarMappingOptionOverrides(numberOption('min'), fieldConfig)).toEqual([
      expect.objectContaining({ tooltip: 'This option uses variables' }),
    ]);
  });

  it('marks a number input but not a slider, whose expression the panel ignores', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: { varMappings: { min: '$min', 'custom.lineWidth': '$w' } },
      overrides: [
        {
          matcher: { id: 'byName', options: 'A' },
          properties: [{ id: 'varMappings.custom.fillOpacity', value: '$o' }],
        },
      ],
    };

    expect(getVarMappingOptionOverrides(numberOption('min'), fieldConfig)).toEqual([
      expect.objectContaining({ tooltip: 'This option uses variables' }),
    ]);
    expect(getVarMappingOptionOverrides(numberOption('custom.lineWidth', 'slider'), fieldConfig)).toEqual([]);
    expect(getVarMappingOptionOverrides(numberOption('custom.fillOpacity', 'slider'), fieldConfig)).toEqual([]);
  });

  describe('text options that interpolate', () => {
    it('marks a text with a variable in the defaults, including in a custom option', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: { displayName: '${__field.labels.host}', custom: { axisLabel: 'Load on $host' } },
        overrides: [],
      };

      expect(getVarMappingOptionOverrides(textOption('displayName'), fieldConfig)).toEqual([
        expect.objectContaining({ type: 'variable', tooltip: 'This option uses variables' }),
      ]);
      expect(getVarMappingOptionOverrides(textOption('custom.axisLabel'), fieldConfig)).toEqual([
        expect.objectContaining({ tooltip: 'This option uses variables' }),
      ]);
    });

    it('marks a text with a variable in an override rule', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'displayName', value: '[[env]]' }] }],
      };

      expect(getVarMappingOptionOverrides(textOption('displayName'), fieldConfig)).toEqual([
        expect.objectContaining({ tooltip: 'This option uses variables' }),
      ]);
    });

    it('does not mark a text when an override sets a variable on another option', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          { matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'custom.axisLabel', value: '$host' }] },
        ],
      };

      expect(getVarMappingOptionOverrides(textOption('displayName'), fieldConfig)).toEqual([]);
    });

    it('does not mark plain text, a lone $ or an option that does not interpolate', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: { displayName: 'Costs in $', noValue: '$host' },
        overrides: [],
      };

      expect(getVarMappingOptionOverrides(textOption('displayName'), fieldConfig)).toEqual([]);
      expect(getVarMappingOptionOverrides(option('noValue'), fieldConfig)).toEqual([]);
    });
  });
});
