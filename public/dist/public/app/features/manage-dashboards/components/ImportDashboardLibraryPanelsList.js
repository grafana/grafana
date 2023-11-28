import { css } from '@emotion/css';
import React from 'react';
import { Field, useStyles2 } from '@grafana/ui';
import { LibraryPanelCard } from '../../library-panels/components/LibraryPanelCard/LibraryPanelCard';
import { LibraryPanelInputState } from '../state/reducers';
export function ImportDashboardLibraryPanelsList({ inputs, label, description, folderName, }) {
    const styles = useStyles2(getStyles);
    if (!Boolean(inputs === null || inputs === void 0 ? void 0 : inputs.length)) {
        return null;
    }
    return (React.createElement("div", { className: styles.spacer },
        React.createElement(Field, { label: label, description: description },
            React.createElement(React.Fragment, null, inputs.map((input, index) => {
                const libraryPanelIndex = `elements[${index}]`;
                const libraryPanel = input.state === LibraryPanelInputState.New
                    ? Object.assign(Object.assign({}, input.model), { meta: Object.assign(Object.assign({}, input.model.meta), { folderName: folderName !== null && folderName !== void 0 ? folderName : 'General' }) }) : Object.assign({}, input.model);
                return (React.createElement("div", { className: styles.item, key: libraryPanelIndex },
                    React.createElement(LibraryPanelCard, { libraryPanel: libraryPanel, onClick: () => undefined })));
            })))));
}
function getStyles(theme) {
    return {
        spacer: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        item: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
}
//# sourceMappingURL=ImportDashboardLibraryPanelsList.js.map