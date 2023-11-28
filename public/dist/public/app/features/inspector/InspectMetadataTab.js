import React from 'react';
import { Trans } from 'app/core/internationalization';
export const InspectMetadataTab = ({ data, metadataDatasource }) => {
    var _a;
    if (!metadataDatasource || !((_a = metadataDatasource.components) === null || _a === void 0 ? void 0 : _a.MetadataInspector)) {
        return React.createElement(Trans, { i18nKey: "dashboard.inspect-meta.no-inspector" }, "No Metadata Inspector");
    }
    return React.createElement(metadataDatasource.components.MetadataInspector, { datasource: metadataDatasource, data: data.series });
};
//# sourceMappingURL=InspectMetadataTab.js.map