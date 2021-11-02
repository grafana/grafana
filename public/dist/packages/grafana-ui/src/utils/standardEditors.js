import { __assign } from "tslib";
import React from 'react';
import { dataLinksOverrideProcessor, FieldType, numberOverrideProcessor, standardEditorsRegistry, stringOverrideProcessor, thresholdsOverrideProcessor, valueMappingsOverrideProcessor, ThresholdsMode, identityOverrideProcessor, displayNameOverrideProcessor, } from '@grafana/data';
import { Switch } from '../components/Switch/Switch';
import { NumberValueEditor, SliderValueEditor, RadioButtonGroup, StringValueEditor, StringArrayEditor, SelectValueEditor, MultiSelectValueEditor, TimeZonePicker, } from '../components';
import { ValueMappingsValueEditor } from '../components/OptionsUI/mappings';
import { ThresholdsValueEditor } from '../components/OptionsUI/thresholds';
import { UnitValueEditor } from '../components/OptionsUI/units';
import { DataLinksValueEditor } from '../components/OptionsUI/links';
import { ColorValueEditor } from '../components/OptionsUI/color';
import { FieldColorEditor } from '../components/OptionsUI/fieldColor';
import { StatsPickerEditor } from '../components/OptionsUI/stats';
import { FieldNamePicker } from '../components/MatchersUI/FieldNamePicker';
/**
 * Returns collection of common field config properties definitions
 */
export var getStandardFieldConfigs = function () {
    var category = ['Standard options'];
    var displayName = {
        id: 'displayName',
        path: 'displayName',
        name: 'Display name',
        description: 'Change the field or series name',
        editor: standardEditorsRegistry.get('text').editor,
        override: standardEditorsRegistry.get('text').editor,
        process: displayNameOverrideProcessor,
        settings: {
            placeholder: 'none',
            expandTemplateVars: true,
        },
        shouldApply: function () { return true; },
        category: category,
    };
    var unit = {
        id: 'unit',
        path: 'unit',
        name: 'Unit',
        description: '',
        editor: standardEditorsRegistry.get('unit').editor,
        override: standardEditorsRegistry.get('unit').editor,
        process: stringOverrideProcessor,
        settings: {
            placeholder: 'none',
        },
        shouldApply: function () { return true; },
        category: category,
    };
    var min = {
        id: 'min',
        path: 'min',
        name: 'Min',
        description: 'Leave empty to calculate based on all values',
        editor: standardEditorsRegistry.get('number').editor,
        override: standardEditorsRegistry.get('number').editor,
        process: numberOverrideProcessor,
        settings: {
            placeholder: 'auto',
        },
        shouldApply: function (field) { return field.type === FieldType.number; },
        category: category,
    };
    var max = {
        id: 'max',
        path: 'max',
        name: 'Max',
        description: 'Leave empty to calculate based on all values',
        editor: standardEditorsRegistry.get('number').editor,
        override: standardEditorsRegistry.get('number').editor,
        process: numberOverrideProcessor,
        settings: {
            placeholder: 'auto',
        },
        shouldApply: function (field) { return field.type === FieldType.number; },
        category: category,
    };
    var decimals = {
        id: 'decimals',
        path: 'decimals',
        name: 'Decimals',
        editor: standardEditorsRegistry.get('number').editor,
        override: standardEditorsRegistry.get('number').editor,
        process: numberOverrideProcessor,
        settings: {
            placeholder: 'auto',
            min: 0,
            max: 15,
            integer: true,
        },
        shouldApply: function (field) { return field.type === FieldType.number; },
        category: category,
    };
    var thresholds = {
        id: 'thresholds',
        path: 'thresholds',
        name: 'Thresholds',
        editor: standardEditorsRegistry.get('thresholds').editor,
        override: standardEditorsRegistry.get('thresholds').editor,
        process: thresholdsOverrideProcessor,
        settings: {},
        defaultValue: {
            mode: ThresholdsMode.Absolute,
            steps: [
                { value: -Infinity, color: 'green' },
                { value: 80, color: 'red' },
            ],
        },
        shouldApply: function () { return true; },
        category: ['Thresholds'],
        getItemsCount: function (value) { return (value ? value.steps.length : 0); },
    };
    var mappings = {
        id: 'mappings',
        path: 'mappings',
        name: 'Value mappings',
        description: 'Modify the display text based on input value',
        editor: standardEditorsRegistry.get('mappings').editor,
        override: standardEditorsRegistry.get('mappings').editor,
        process: valueMappingsOverrideProcessor,
        settings: {},
        defaultValue: [],
        shouldApply: function () { return true; },
        category: ['Value mappings'],
        getItemsCount: function (value) { return (value ? value.length : 0); },
    };
    var noValue = {
        id: 'noValue',
        path: 'noValue',
        name: 'No Value',
        description: 'What to show when there is no value',
        editor: standardEditorsRegistry.get('text').editor,
        override: standardEditorsRegistry.get('text').editor,
        process: stringOverrideProcessor,
        settings: {
            placeholder: '-',
        },
        // ??? any optionsUi with no value
        shouldApply: function () { return true; },
        category: category,
    };
    var links = {
        id: 'links',
        path: 'links',
        name: 'Data links',
        editor: standardEditorsRegistry.get('links').editor,
        override: standardEditorsRegistry.get('links').editor,
        process: dataLinksOverrideProcessor,
        settings: {
            placeholder: '-',
        },
        shouldApply: function () { return true; },
        category: ['Data links'],
        getItemsCount: function (value) { return (value ? value.length : 0); },
    };
    var color = {
        id: 'color',
        path: 'color',
        name: 'Color scheme',
        editor: standardEditorsRegistry.get('fieldColor').editor,
        override: standardEditorsRegistry.get('fieldColor').editor,
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
        settings: {
            byValueSupport: true,
            preferThresholdsMode: true,
        },
        category: category,
    };
    return [unit, min, max, decimals, displayName, color, noValue, thresholds, mappings, links];
};
/**
 * Returns collection of standard option editors definitions
 *
 * @internal
 */
export var getStandardOptionEditors = function () {
    var number = {
        id: 'number',
        name: 'Number',
        description: 'Allows numeric values input',
        editor: NumberValueEditor,
    };
    var slider = {
        id: 'slider',
        name: 'Slider',
        description: 'Allows numeric values input',
        editor: SliderValueEditor,
    };
    var text = {
        id: 'text',
        name: 'Text',
        description: 'Allows string values input',
        editor: StringValueEditor,
    };
    var strings = {
        id: 'strings',
        name: 'String array',
        description: 'An array of strings',
        editor: StringArrayEditor,
    };
    var boolean = {
        id: 'boolean',
        name: 'Boolean',
        description: 'Allows boolean values input',
        editor: function (props) {
            return React.createElement(Switch, __assign({}, props, { onChange: function (e) { return props.onChange(e.currentTarget.checked); } }));
        },
    };
    var select = {
        id: 'select',
        name: 'Select',
        description: 'Allows option selection',
        editor: SelectValueEditor,
    };
    var multiSelect = {
        id: 'multi-select',
        name: 'Multi select',
        description: 'Allows for multiple option selection',
        editor: MultiSelectValueEditor,
    };
    var radio = {
        id: 'radio',
        name: 'Radio',
        description: 'Allows option selection',
        editor: function (props) {
            var _a;
            return React.createElement(RadioButtonGroup, __assign({}, props, { options: (_a = props.item.settings) === null || _a === void 0 ? void 0 : _a.options }));
        },
    };
    var unit = {
        id: 'unit',
        name: 'Unit',
        description: 'Allows unit input',
        editor: UnitValueEditor,
    };
    var thresholds = {
        id: 'thresholds',
        name: 'Thresholds',
        description: 'Allows defining thresholds',
        editor: ThresholdsValueEditor,
    };
    var mappings = {
        id: 'mappings',
        name: 'Mappings',
        description: 'Allows defining value mappings',
        editor: ValueMappingsValueEditor,
    };
    var color = {
        id: 'color',
        name: 'Color',
        description: 'Allows color selection',
        editor: function (props) {
            return React.createElement(ColorValueEditor, { value: props.value, onChange: props.onChange });
        },
    };
    var fieldColor = {
        id: 'fieldColor',
        name: 'Field Color',
        description: 'Field color selection',
        editor: FieldColorEditor,
    };
    var links = {
        id: 'links',
        name: 'Links',
        description: 'Allows defining data links',
        editor: DataLinksValueEditor,
    };
    var statsPicker = {
        id: 'stats-picker',
        name: 'Stats Picker',
        editor: StatsPickerEditor,
        description: '',
    };
    var timeZone = {
        id: 'timezone',
        name: 'Time Zone',
        description: 'Time zone selection',
        editor: TimeZonePicker,
    };
    var fieldName = {
        id: 'field-name',
        name: 'Field name',
        description: 'Time zone selection',
        editor: FieldNamePicker,
    };
    return [
        text,
        number,
        slider,
        boolean,
        radio,
        select,
        unit,
        mappings,
        thresholds,
        links,
        statsPicker,
        strings,
        timeZone,
        fieldColor,
        color,
        multiSelect,
        fieldName,
    ];
};
//# sourceMappingURL=standardEditors.js.map