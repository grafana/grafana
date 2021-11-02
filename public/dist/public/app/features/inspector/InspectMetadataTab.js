import React from 'react';
export var InspectMetadataTab = function (_a) {
    var _b;
    var data = _a.data, metadataDatasource = _a.metadataDatasource;
    if (!metadataDatasource || !((_b = metadataDatasource.components) === null || _b === void 0 ? void 0 : _b.MetadataInspector)) {
        return React.createElement("div", null, "No Metadata Inspector");
    }
    return React.createElement(metadataDatasource.components.MetadataInspector, { datasource: metadataDatasource, data: data.series });
};
//# sourceMappingURL=InspectMetadataTab.js.map