import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Table, useStyles2 } from '@grafana/ui';
import { StorageView } from './types';
export function FolderView({ listing, view }) {
    const styles = useStyles2(getStyles);
    switch (view) {
        case StorageView.Config:
            return React.createElement("div", null, "CONFIGURE?");
        case StorageView.Perms:
            return React.createElement("div", null, "Permissions");
    }
    return (React.createElement("div", { className: styles.tableWrapper },
        React.createElement(AutoSizer, null, ({ width, height }) => (React.createElement("div", { style: { width: `${width}px`, height: `${height}px` } },
            React.createElement(Table, { height: height, width: width, data: listing, noHeader: false, showTypeIcons: false, resizable: false }))))));
}
const getStyles = (theme) => ({
    // TODO: remove `height: 90%`
    wrapper: css `
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
    tableControlRowWrapper: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.spacing(2)};
  `,
    // TODO: remove `height: 100%`
    tableWrapper: css `
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
    uploadSpot: css `
    margin-left: ${theme.spacing(2)};
  `,
    border: css `
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=FolderView.js.map