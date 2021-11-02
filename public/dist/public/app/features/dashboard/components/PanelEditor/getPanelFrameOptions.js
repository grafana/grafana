import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/angular/panel/panellinks/link_srv';
import React from 'react';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
export function getPanelFrameCategory(props) {
    var _a;
    var panel = props.panel, onPanelConfigChange = props.onPanelConfigChange;
    var descriptor = new OptionsPaneCategoryDescriptor({
        title: 'Panel options',
        id: 'Panel options',
        isOpenDefault: true,
    });
    return descriptor
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.title,
        popularRank: 1,
        render: function renderTitle() {
            return (React.createElement(Input, { id: "PanelFrameTitle", defaultValue: panel.title, onBlur: function (e) { return onPanelConfigChange('title', e.currentTarget.value); } }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Description',
        description: panel.description,
        value: panel.description,
        render: function renderDescription() {
            return (React.createElement(TextArea, { id: "description-text-area", defaultValue: panel.description, onBlur: function (e) { return onPanelConfigChange('description', e.currentTarget.value); } }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
            return (React.createElement(Switch, { value: panel.transparent, id: "Transparent background", onChange: function (e) { return onPanelConfigChange('transparent', e.currentTarget.checked); } }));
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
            return (React.createElement(DataLinksInlineEditor, { links: panel.links, onChange: function (links) { return onPanelConfigChange('links', links); }, getSuggestions: getPanelLinksVariableSuggestions, data: [] }));
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
            return (React.createElement(RepeatRowSelect, { id: "repeat-by-variable-select", repeat: panel.repeat, onChange: function (value) {
                    onPanelConfigChange('repeat', value);
                } }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Repeat direction',
        showIf: function () { return !!panel.repeat; },
        render: function renderRepeatOptions() {
            var directionOptions = [
                { label: 'Horizontal', value: 'h' },
                { label: 'Vertical', value: 'v' },
            ];
            return (React.createElement(RadioButtonGroup, { options: directionOptions, value: panel.repeatDirection || 'h', onChange: function (value) { return onPanelConfigChange('repeatDirection', value); } }));
        },
    }))
        .addItem(new OptionsPaneItemDescriptor({
        title: 'Max per row',
        showIf: function () { return Boolean(panel.repeat && panel.repeatDirection === 'h'); },
        render: function renderOption() {
            var maxPerRowOptions = [2, 3, 4, 6, 8, 12].map(function (value) { return ({ label: value.toString(), value: value }); });
            return (React.createElement(Select, { menuShouldPortal: true, options: maxPerRowOptions, value: panel.maxPerRow, onChange: function (value) { return onPanelConfigChange('maxPerRow', value.value); } }));
        },
    })));
}
//# sourceMappingURL=getPanelFrameOptions.js.map