import React from 'react';
import { PageLayoutType } from '@grafana/data';
import { Page } from '../Page/Page';
import { EntityNotFound } from './EntityNotFound';
export function PageNotFound() {
    return (React.createElement(Page, { navId: "home", layout: PageLayoutType.Canvas, pageNav: { text: 'Page not found' } },
        React.createElement(EntityNotFound, { entity: "Page" })));
}
//# sourceMappingURL=PageNotFound.js.map