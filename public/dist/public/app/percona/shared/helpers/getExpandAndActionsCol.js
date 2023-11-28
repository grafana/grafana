import { css, cx } from '@emotion/css';
import React from 'react';
import { ExpandAndActionsCol } from '../components/Elements/ExpandAndActionsCol/ExpandAndActionsCol';
export const getExpandAndActionsCol = (actionsGetter = () => [], children, className, options) => {
    return Object.assign({ Header: 'Options', Cell: ({ row }) => (React.createElement(ExpandAndActionsCol, { actions: actionsGetter(row), row: row }, children)), 
        // @ts-ignore
        className: cx(css `
        &[role='columnheader'] {
          text-align: right;
        }
      `, !children &&
            css `
          width: 70px;
        `, className) }, options);
};
//# sourceMappingURL=getExpandAndActionsCol.js.map