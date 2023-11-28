import React from 'react';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';
export const PageContent = ({ hasData, emptyMessage, loading, children }) => hasData ? React.createElement(React.Fragment, null, children) : React.createElement(EmptyBlock, { dataTestId: "page-no-data" }, !loading && React.createElement("h1", null, emptyMessage));
//# sourceMappingURL=PageContent.js.map