import { css } from '@emotion/css';
import React from 'react';
import { LogGroupSelector } from './LegacyLogGroupSelector';
const rowGap = css `
  gap: 3px;
`;
export const LegacyLogGroupSelection = ({ datasource, region, legacyLogGroupNames, onChange }) => {
    return (React.createElement("div", { className: `gf-form gf-form--grow flex-grow-1 ${rowGap}` },
        React.createElement(LogGroupSelector, { region: region, selectedLogGroups: legacyLogGroupNames, datasource: datasource, onChange: onChange })));
};
//# sourceMappingURL=LegacyLogGroupNamesSelection.js.map