import { __assign } from "tslib";
import { Input } from '@grafana/ui';
import React from 'react';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryPanelInformation } from 'app/features/library-panels/components/LibraryPanelInfo/LibraryPanelInfo';
export function getLibraryPanelOptionsCategory(props) {
    var panel = props.panel, onPanelConfigChange = props.onPanelConfigChange, dashboard = props.dashboard;
    var descriptor = new OptionsPaneCategoryDescriptor({
        title: 'Library panel options',
        id: 'Library panel options',
        isOpenDefault: true,
    });
    if (isPanelModelLibraryPanel(panel)) {
        descriptor
            .addItem(new OptionsPaneItemDescriptor({
            title: 'Name',
            value: panel.libraryPanel.name,
            popularRank: 1,
            render: function renderName() {
                return (React.createElement(Input, { id: "LibraryPanelFrameName", defaultValue: panel.libraryPanel.name, onBlur: function (e) {
                        return onPanelConfigChange('libraryPanel', __assign(__assign({}, panel.libraryPanel), { name: e.currentTarget.value }));
                    } }));
            },
        }))
            .addItem(new OptionsPaneItemDescriptor({
            title: 'Information',
            render: function renderLibraryPanelInformation() {
                return React.createElement(LibraryPanelInformation, { panel: panel, formatDate: dashboard.formatDate });
            },
        }));
    }
    return descriptor;
}
//# sourceMappingURL=getLibraryPanelOptions.js.map