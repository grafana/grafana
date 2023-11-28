import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { OldFolderPicker } from 'app/core/components/Select/OldFolderPicker';
import { PermissionLevelString, SearchQueryType } from 'app/types';
const SlashesWarning = () => {
    const styles = useStyles2(getStyles);
    const onClick = () => window.open('https://github.com/grafana/grafana/issues/42947', '_blank');
    return (React.createElement(Stack, { gap: 0.5 },
        React.createElement("div", { className: styles.slashNotAllowed }, "Folders with '/' character are not allowed."),
        React.createElement(Tooltip, { placement: "top", content: 'Link to the Github issue', theme: "info" },
            React.createElement(Icon, { name: "info-circle", size: "xs", className: styles.infoIcon, onClick: onClick }))));
};
export const containsSlashes = (str) => str.indexOf('/') !== -1;
export function RuleFolderPicker(props) {
    const { value } = props;
    const warningCondition = (folderName) => containsSlashes(folderName);
    const folderWarning = {
        warningCondition: warningCondition,
        warningComponent: SlashesWarning,
    };
    const customAdd = {
        disallowValues: true,
        isAllowedValue: (value) => !containsSlashes(value),
    };
    return (React.createElement(OldFolderPicker, Object.assign({ showRoot: false, rootName: "", allowEmpty: true, initialTitle: value === null || value === void 0 ? void 0 : value.title, initialFolderUid: value === null || value === void 0 ? void 0 : value.uid, searchQueryType: SearchQueryType.AlertFolder }, props, { permissionLevel: PermissionLevelString.Edit, customAdd: customAdd, folderWarning: folderWarning })));
}
const getStyles = (theme) => ({
    slashNotAllowed: css `
    color: ${theme.colors.warning.main};
    font-size: 12px;
    margin-bottom: 2px;
  `,
    infoIcon: css `
    color: ${theme.colors.warning.main};
    font-size: 12px;
    margin-bottom: 2px;
    cursor: pointer;
  `,
});
//# sourceMappingURL=RuleFolderPicker.js.map