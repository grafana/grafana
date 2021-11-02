import { Button } from '@grafana/ui';
import { addDataSource } from 'app/features/datasources/state/actions';
import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { isDataSourceEditor } from '../../permissions';
export function GetStartedWithDataSource(_a) {
    var plugin = _a.plugin;
    var dispatch = useDispatch();
    var onAddDataSource = useCallback(function () {
        var meta = {
            name: plugin.name,
            id: plugin.id,
        };
        dispatch(addDataSource(meta));
    }, [dispatch, plugin]);
    if (!isDataSourceEditor()) {
        return null;
    }
    return (React.createElement(Button, { variant: "primary", onClick: onAddDataSource },
        "Create a ",
        plugin.name,
        " data source"));
}
//# sourceMappingURL=GetStartedWithDataSource.js.map