import React, { useCallback } from 'react';
import { Button } from '@grafana/ui';
import { useDataSourcesRoutes, addDataSource } from 'app/features/datasources/state';
import { useDispatch } from 'app/types';
import { isDataSourceEditor } from '../../permissions';
export function GetStartedWithDataSource({ plugin }) {
    const dispatch = useDispatch();
    const dataSourcesRoutes = useDataSourcesRoutes();
    const onAddDataSource = useCallback(() => {
        const meta = {
            name: plugin.name,
            id: plugin.id,
        };
        dispatch(addDataSource(meta, dataSourcesRoutes.Edit));
    }, [dispatch, plugin, dataSourcesRoutes]);
    if (!isDataSourceEditor()) {
        return null;
    }
    return (React.createElement(Button, { variant: "primary", onClick: onAddDataSource }, "Add new data source"));
}
//# sourceMappingURL=GetStartedWithDataSource.js.map