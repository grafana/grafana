import React, { useContext } from 'react';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';
import { Page } from './Page';
export function PluginPage({ actions, children, info, pageNav, layout, renderTitle, subTitle }) {
    const context = useContext(PluginPageContext);
    return (React.createElement(Page, { navModel: context.sectionNav, pageNav: pageNav, layout: layout, actions: actions, renderTitle: renderTitle, info: info, subTitle: subTitle },
        React.createElement(Page.Contents, null, children)));
}
//# sourceMappingURL=PluginPage.js.map