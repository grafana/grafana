import { __rest } from "tslib";
import React from 'react';
import { FieldType, standardEditorsRegistry, ThresholdsMode, thresholdsOverrideProcessor, valueMappingsOverrideProcessor, dataLinksOverrideProcessor, numberOverrideProcessor, stringOverrideProcessor, identityOverrideProcessor, displayNameOverrideProcessor, booleanOverrideProcessor, } from '@grafana/data';
import { RadioButtonGroup, TimeZonePicker, Switch } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ThresholdsValueEditor } from 'app/features/dimensions/editors/ThresholdsEditor/thresholds';
import { ValueMappingsEditor } from 'app/features/dimensions/editors/ValueMappingsEditor/ValueMappingsEditor';
import { DashboardPicker } from './DashboardPicker';
import { ColorValueEditor } from './color';
import { FieldColorEditor } from './fieldColor';
import { DataLinksValueEditor } from './links';
import { MultiSelectValueEditor } from './multiSelect';
import { NumberValueEditor } from './number';
import { SelectValueEditor } from './select';
import { SliderValueEditor } from './slider';
import { StatsPickerEditor } from './stats';
import { StringValueEditor } from './string';
import { StringArrayEditor } from './strings';
import { UnitValueEditor } from './units';
/**
 * Returns collection of standard option editors definitions
 */
export const getAllOptionEditors = () => {
    const number = {
        id: 'number',
        name: 'Number',
        description: 'Allows numeric values input',
        editor: NumberValueEditor,
    };
    const slider = {
        id: 'slider',
        name: 'Slider',
        description: 'Allows numeric values input',
        editor: SliderValueEditor,
    };
    const text = {
        id: 'text',
        name: 'Text',
        description: 'Allows string values input',
        editor: StringValueEditor,
    };
    const strings = {
        id: 'strings',
        name: 'String array',
        description: 'An array of strings',
        editor: StringArrayEditor,
    };
    const boolean = {
        id: 'boolean',
        name: 'Boolean',
        description: 'Allows boolean values input',
        editor(props) {
            const { id } = props, rest = __rest(props, ["id"]); // Remove id from properties passed into switch
            return React.createElement(Switch, Object.assign({}, rest, { onChange: (e) => props.onChange(e.currentTarget.checked) }));
        },
    };
    const select = {
        id: 'select',
        name: 'Select',
        description: 'Allows option selection',
        editor: SelectValueEditor,
    };
    const multiSelect = {
        id: 'multi-select',
        name: 'Multi select',
        description: 'Allows for multiple option selection',
        editor: MultiSelectValueEditor,
    };
    const radio = {
        id: 'radio',
        name: 'Radio',
        description: 'Allows option selection',
        editor(props) {
            var _a;
            return React.createElement(RadioButtonGroup, Object.assign({}, props, { options: (_a = props.item.settings) === null || _a === void 0 ? void 0 : _a.options }));
        },
    };
    const unit = {
        id: 'unit',
        name: 'Unit',
        description: 'Allows unit input',
        editor: UnitValueEditor,
    };
    const color = {
        id: 'color',
        name: 'Color',
        description: 'Allows color selection',
        editor(props) {
            return (React.createElement(ColorValueEditor, { value: props.value, onChange: props.onChange, settings: props.item.settings, details: true }));
        },
    };
    const fieldColor = {
        id: 'fieldColor',
        name: 'Field Color',
        description: 'Field color selection',
        editor: FieldColorEditor,
    };
    const links = {
        id: 'links',
        name: 'Links',
        description: 'Allows defining data links',
        editor: DataLinksValueEditor,
    };
    const statsPicker = {
        id: 'stats-picker',
        name: 'Stats Picker',
        editor: StatsPickerEditor,
        description: '',
    };
    const timeZone = {
        id: 'timezone',
        name: 'Time zone',
        description: 'Time zone selection',
        editor: TimeZonePicker,
    };
    const fieldName = {
        id: 'field-name',
        name: 'Field name',
        description: 'Allows selecting a field name from a data frame',
        editor: FieldNamePicker,
    };
    const dashboardPicker = {
        id: 'dashboard-uid',
        name: 'Dashboard',
        description: 'Select dashboard',
        editor: DashboardPicker,
    };
    const mappings = {
        id: 'mappings',
        name: 'Mappings',
        description: 'Allows defining value mappings',
        editor: ValueMappingsEditor,
    };
    const thresholds = {
        id: 'thresholds',
        name: 'Thresholds',
        description: 'Allows defining thresholds',
        editor: ThresholdsValueEditor,
    };
    return [
        text,
        number,
        slider,
        boolean,
        radio,
        select,
        unit,
        links,
        statsPicker,
        strings,
        timeZone,
        fieldColor,
        color,
        multiSelect,
        fieldName,
        dashboardPicker,
        mappings,
        thresholds,
    ];
};
/**
 * Returns collection of common field config properties definitions
 */
export const getAllStandardFieldConfigs = () => {
    const category = ['Standard options'];
    const displayName = {
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
        shouldApply: () => true,
        category,
    };
    const unit = {
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
        shouldApply: () => true,
        category,
    };
    const fieldMinMax = {
        id: 'fieldMinMax',
        path: 'fieldMinMax',
        name: 'Field min/max',
        description: 'Calculate min max per field',
        editor: standardEditorsRegistry.get('boolean').editor,
        override: standardEditorsRegistry.get('boolean').editor,
        process: booleanOverrideProcessor,
        shouldApply: (field) => field.type === FieldType.number,
        showIf: (options) => {
            return options.min === undefined || options.max === undefined;
        },
        category,
    };
    const min = {
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
        shouldApply: (field) => field.type === FieldType.number,
        category,
    };
    const max = {
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
        shouldApply: (field) => field.type === FieldType.number,
        category,
    };
    const decimals = {
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
        shouldApply: (field) => field.type === FieldType.number,
        category,
    };
    const noValue = {
        id: 'noValue',
        path: 'noValue',
        name: 'No value',
        description: 'What to show when there is no value',
        editor: standardEditorsRegistry.get('text').editor,
        override: standardEditorsRegistry.get('text').editor,
        process: stringOverrideProcessor,
        settings: {
            placeholder: '-',
        },
        // ??? any optionsUi with no value
        shouldApply: () => true,
        category,
    };
    const links = {
        id: 'links',
        path: 'links',
        name: 'Data links',
        editor: standardEditorsRegistry.get('links').editor,
        override: standardEditorsRegistry.get('links').editor,
        process: dataLinksOverrideProcessor,
        settings: {
            placeholder: '-',
        },
        shouldApply: () => true,
        category: ['Data links'],
        getItemsCount: (value) => (value ? value.length : 0),
    };
    const color = {
        id: 'color',
        path: 'color',
        name: 'Color scheme',
        editor: standardEditorsRegistry.get('fieldColor').editor,
        override: standardEditorsRegistry.get('fieldColor').editor,
        process: identityOverrideProcessor,
        shouldApply: () => true,
        settings: {
            byValueSupport: true,
            preferThresholdsMode: true,
        },
        category,
    };
    const mappings = {
        id: 'mappings',
        path: 'mappings',
        name: 'Value mappings',
        description: 'Modify the display text based on input value',
        editor: standardEditorsRegistry.get('mappings').editor,
        override: standardEditorsRegistry.get('mappings').editor,
        process: valueMappingsOverrideProcessor,
        settings: {},
        defaultValue: [],
        shouldApply: (x) => x.type !== FieldType.time,
        category: ['Value mappings'],
        getItemsCount: (value) => (value ? value.length : 0),
    };
    const thresholds = {
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
        shouldApply: () => true,
        category: ['Thresholds'],
        getItemsCount: (value) => (value ? value.steps.length : 0),
    };
    const filterable = {
        id: 'filterable',
        path: 'filterable',
        name: 'Ad-hoc filterable',
        hideFromDefaults: true,
        editor: standardEditorsRegistry.get('boolean').editor,
        override: standardEditorsRegistry.get('boolean').editor,
        process: booleanOverrideProcessor,
        shouldApply: () => true,
        settings: {},
        category,
    };
    return [unit, min, max, fieldMinMax, decimals, displayName, color, noValue, links, mappings, thresholds, filterable];
};
//# sourceMappingURL=registry.js.map