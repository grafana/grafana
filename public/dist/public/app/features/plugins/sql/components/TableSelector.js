import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
export const TableSelector = ({ db, dataset, table, className, onChange }) => {
    const state = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        // No need to attempt to fetch tables for an unknown dataset.
        if (!dataset) {
            return [];
        }
        const tables = yield db.tables(dataset);
        return tables.map(toOption);
    }), [dataset]);
    return (React.createElement(Select, { className: className, disabled: state.loading, "aria-label": "Table selector", value: table, options: state.value, onChange: onChange, isLoading: state.loading, menuShouldPortal: true, placeholder: state.loading ? 'Loading tables' : 'Select table' }));
};
//# sourceMappingURL=TableSelector.js.map