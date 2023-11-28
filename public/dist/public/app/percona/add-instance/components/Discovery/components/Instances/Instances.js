import React from 'react';
import { Table } from 'app/percona/shared/components/Elements/AnotherTableInstance/Table';
import { styles } from './Instances.styles';
import { getInstancesColumns } from './InstancesColumns';
const Instances = (props) => {
    const { instances, selectInstance, credentials, loading } = props;
    const columns = getInstancesColumns(credentials, selectInstance);
    return (React.createElement("div", { className: styles.tableWrapper, "data-testid": "instances-table-wrapper" },
        React.createElement(Table, { columns: columns, data: instances, loading: loading })));
};
export default Instances;
//# sourceMappingURL=Instances.js.map