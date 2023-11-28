import React, { useEffect, useState } from 'react';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { useDispatch } from 'app/types';
import { getNewDashboardModelData, setDashboardToFetchFromLocalStorage } from '../state/initDashboard';
import { setInitialDatasource } from '../state/reducers';
export default function NewDashboardWithDS(props) {
    const [error, setError] = useState(null);
    const { datasourceUid } = props.match.params;
    const dispatch = useDispatch();
    useEffect(() => {
        const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
        if (!ds) {
            setError('Data source not found');
            return;
        }
        if (!config.featureToggles.emptyDashboardPage) {
            const newDashboard = getNewDashboardModelData();
            const { dashboard } = newDashboard;
            dashboard.panels[0] = Object.assign(Object.assign({}, dashboard.panels[0]), { datasource: {
                    uid: ds.uid,
                    type: ds.type,
                } });
            setDashboardToFetchFromLocalStorage(newDashboard);
        }
        else {
            dispatch(setInitialDatasource(datasourceUid));
        }
        locationService.replace('/dashboard/new');
    }, [datasourceUid, dispatch]);
    if (error) {
        return (React.createElement(Page, { navId: "dashboards" },
            React.createElement(Page.Contents, null,
                React.createElement("div", null,
                    "Data source with UID \"",
                    datasourceUid,
                    "\" not found."))));
    }
    return null;
}
//# sourceMappingURL=NewDashboardWithDS.js.map