import { cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Table as PerconaTable } from '../../../../../shared/components/Elements/Table';
import { getStyles } from './Table.styles';
const Table = (props) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.Table, props.style) },
        React.createElement(PerconaTable, Object.assign({}, props, { columns: props.columns }))));
};
export default Table;
//# sourceMappingURL=Table.js.map