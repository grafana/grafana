import React from 'react';
import { config } from '@grafana/runtime';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { GenAIPanelDescriptionButton } from '../GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from '../GenAI/GenAIPanelTitleButton';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
export function getPanelFrameCategory(props) {
    var _a;
    const { panel, onPanelConfigChange } = props;
    const descriptor = new OptionsPaneCategoryDescriptor({
        title: 'Panel options',
        id: 'Panel options',
        isOpenDefault: true,
    });
    const setPanelTitle = (title) => {
        const input = document.getElementById('PanelFrameTitle');
        if (input instanceof HTMLInputElement) {
            input.value = title;
            onPanelConfigChange('title', title);
        }
    };
    const setPanelDescription = (description) => {
        const input = document.getElementById('description-text-area');
        if (input instanceof HTMLTextAreaElement) {
            input.value = description;
            onPanelConfigChange('description', description);
        }
    };
    return descriptor
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.title,
        popularRank: 1,
        render: function renderTitle() {
            return (React.createElement(Input, { id: "PanelFrameTitle", defaultValue: panel.title, onBlur: (e) => onPanelConfigChange('title', e.currentTarget.value) }));
        },
        addon: config.featureToggles.dashgpt && React.createElement(GenAIPanelTitleButton, { onGenerate: setPanelTitle, panel: panel }),
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Description',
        description: panel.description,
        value: panel.description,
        render: function renderDescription() {
            return (React.createElement(TextArea, { id: "description-text-area", defaultValue: panel.description, onBlur: (e) => onPanelConfigChange('description', e.currentTarget.value) }));
        },
        addon: config.featureToggles.dashgpt && (React.createElement(GenAIPanelDescriptionButton, { onGenerate: setPanelDescription, panel: panel })),
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
            return (React.createElement(Switch, { value: panel.transparent, id: "transparent-background", onChange: (e) => onPanelConfigChange('transparent', e.currentTarget.checked) }));
        },
    }))
        .addCategory(new OptionsPaneCategoryDescriptor({
        title: 'Panel links',
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: (_a = panel.links) === null || _a === void 0 ? void 0 : _a.length,
    }).addItem(new OptionsPaneItemDescriptor({
        title: 'Panel links',
        render: function renderLinks() {
            return (React.createElement(DataLinksInlineEditor, { links: panel.links, onChange: (links) => onPanelConfigChange('links', links), getSuggestions: getPanelLinksVariableSuggestions, data: [] }));
        },
    })))
        .addCategory(new OptionsPaneCategoryDescriptor({
        title: 'Repeat options',
        id: 'Repeat options',
        isOpenDefault: false,
    })
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Repeat by variable',
        description: 'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
        render: function renderRepeatOptions() {
            return (React.createElement(RepeatRowSelect, { id: "repeat-by-variable-select", repeat: panel.repeat, onChange: (value) => {
                    onPanelConfigChange('repeat', value);
                } }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Repeat direction',
        showIf: () => !!panel.repeat,
        render: function renderRepeatOptions() {
            const directionOptions = [
                { label: 'Horizontal', value: 'h' },
                { label: 'Vertical', value: 'v' },
            ];
            return (React.createElement(RadioButtonGroup, { options: directionOptions, value: panel.repeatDirection || 'h', onChange: (value) => onPanelConfigChange('repeatDirection', value) }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Max per row',
        showIf: () => Boolean(panel.repeat && panel.repeatDirection === 'h'),
        render: function renderOption() {
            const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));
            return (React.createElement(Select, { options: maxPerRowOptions, value: panel.maxPerRow, onChange: (value) => onPanelConfigChange('maxPerRow', value.value) }));
        },
    })));
}
//# sourceMappingURL=getPanelFrameOptions.js.map