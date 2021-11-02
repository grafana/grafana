import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
export default function CloudAdminPage() {
    var navModel = useNavModel('live-status');
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null, "Live/Live/Live")));
}
//# sourceMappingURL=LiveStatusPage.js.map