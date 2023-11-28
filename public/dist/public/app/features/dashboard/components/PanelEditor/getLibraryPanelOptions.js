import React from 'react';
import { Input } from '@grafana/ui';
import { LibraryPanelInformation } from 'app/features/library-panels/components/LibraryPanelInfo/LibraryPanelInfo';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
export function getLibraryPanelOptionsCategory(props) {
    const { panel, onPanelConfigChange, dashboard } = props;
    const descriptor = new OptionsPaneCategoryDescriptor({
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
                return (React.createElement(Input, { id: "LibraryPanelFrameName", defaultValue: panel.libraryPanel.name, onBlur: (e) => onPanelConfigChange('libraryPanel', Object.assign(Object.assign({}, panel.libraryPanel), { name: e.currentTarget.value })) }));
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