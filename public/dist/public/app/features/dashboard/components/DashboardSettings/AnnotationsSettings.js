import React from 'react';
import { getDataSourceRef } from '@grafana/data';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { AnnotationSettingsEdit, AnnotationSettingsList, newAnnotationName } from '../AnnotationSettings';
export function AnnotationsSettings({ dashboard, editIndex, sectionNav }) {
    const onNew = () => {
        const newAnnotation = {
            name: newAnnotationName,
            enable: true,
            datasource: getDataSourceRef(getDataSourceSrv().getInstanceSettings(null)),
            iconColor: 'red',
        };
        dashboard.annotations.list = [...dashboard.annotations.list, Object.assign({}, newAnnotation)];
        locationService.partial({ editIndex: dashboard.annotations.list.length - 1 });
    };
    const onEdit = (idx) => {
        locationService.partial({ editIndex: idx });
    };
    const isEditing = editIndex != null && editIndex < dashboard.annotations.list.length;
    return (React.createElement(Page, { navModel: sectionNav, pageNav: getSubPageNav(dashboard, editIndex, sectionNav.node) },
        !isEditing && React.createElement(AnnotationSettingsList, { dashboard: dashboard, onNew: onNew, onEdit: onEdit }),
        isEditing && React.createElement(AnnotationSettingsEdit, { dashboard: dashboard, editIdx: editIndex })));
}
function getSubPageNav(dashboard, editIndex, node) {
    const parentItem = config.featureToggles.dockedMegaMenu ? node.parentItem : undefined;
    if (editIndex == null) {
        return parentItem;
    }
    const editItem = dashboard.annotations.list[editIndex];
    if (editItem) {
        return {
            text: editItem.name,
            parentItem: parentItem && Object.assign(Object.assign({}, parentItem), { url: node.url }),
        };
    }
    return undefined;
}
//# sourceMappingURL=AnnotationsSettings.js.map