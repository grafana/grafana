import React from 'react';
import { useAsync } from 'react-use';
import { Card, Icon, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getGrafanaStorage } from './storage';
export function StorageFolderPage(props) {
    var _a;
    const slug = (_a = props.match.params.slug) !== null && _a !== void 0 ? _a : '';
    const listing = useAsync(() => {
        return getGrafanaStorage().list('content/' + slug);
    }, [slug]);
    const childRoot = slug.length > 0 ? `g/${slug}/` : 'g/';
    const pageNav = getPageNavFromSlug(slug);
    const renderListing = () => {
        if (listing.value) {
            const names = listing.value.fields[0].values;
            return names.map((item) => {
                let name = item;
                const isFolder = name.indexOf('.') < 0;
                const isDash = !isFolder && name.endsWith('.json');
                const url = `${childRoot}${name}`;
                return (React.createElement(Card, { key: name, href: isFolder || isDash ? url : undefined },
                    React.createElement(Card.Heading, null, name),
                    React.createElement(Card.Figure, null,
                        React.createElement(Icon, { name: isFolder ? 'folder' : isDash ? 'gf-grid' : 'file-alt', size: "sm" }))));
            });
        }
        if (listing.loading) {
            return React.createElement(Spinner, null);
        }
        return React.createElement("div", null, "?");
    };
    const navModel = getRootContentNavModel();
    return (React.createElement(Page, { navModel: navModel, pageNav: pageNav }, renderListing()));
}
export function getPageNavFromSlug(slug) {
    const parts = slug.split('/');
    let pageNavs = [];
    let url = 'g';
    let lastPageNav;
    for (let i = 0; i < parts.length; i++) {
        url += `/${parts[i]}`;
        pageNavs.push({ text: parts[i], url, parentItem: lastPageNav });
        lastPageNav = pageNavs[pageNavs.length - 1];
    }
    return lastPageNav;
}
export function getRootContentNavModel() {
    return { main: { text: 'C:' }, node: { text: 'Content', url: '/g' } };
}
export default StorageFolderPage;
//# sourceMappingURL=StorageFolderPage.js.map