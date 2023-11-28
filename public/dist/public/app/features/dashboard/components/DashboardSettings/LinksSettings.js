import React, { useState } from 'react';
import { config, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';
import { newLink } from '../LinksSettings/LinkSettingsEdit';
export function LinksSettings({ dashboard, sectionNav, editIndex }) {
    const [isNew, setIsNew] = useState(false);
    const onGoBack = () => {
        setIsNew(false);
        locationService.partial({ editIndex: undefined });
    };
    const onNew = () => {
        dashboard.links = [...dashboard.links, Object.assign({}, newLink)];
        setIsNew(true);
        locationService.partial({ editIndex: dashboard.links.length - 1 });
    };
    const onEdit = (idx) => {
        setIsNew(false);
        locationService.partial({ editIndex: idx });
    };
    const isEditing = editIndex !== undefined;
    let pageNav;
    if (config.featureToggles.dockedMegaMenu) {
        pageNav = sectionNav.node.parentItem;
    }
    if (isEditing) {
        const title = isNew ? 'New link' : 'Edit link';
        const description = isNew ? 'Create a new link on your dashboard' : 'Edit a specific link of your dashboard';
        pageNav = {
            text: title,
            subTitle: description,
        };
        if (config.featureToggles.dockedMegaMenu) {
            const parentUrl = sectionNav.node.url;
            pageNav.parentItem = sectionNav.node.parentItem && Object.assign(Object.assign({}, sectionNav.node.parentItem), { url: parentUrl });
        }
    }
    return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
        !isEditing && React.createElement(LinkSettingsList, { dashboard: dashboard, onNew: onNew, onEdit: onEdit }),
        isEditing && React.createElement(LinkSettingsEdit, { dashboard: dashboard, editLinkIdx: editIndex, onGoBack: onGoBack })));
}
//# sourceMappingURL=LinksSettings.js.map