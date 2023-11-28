import React, { useState } from 'react';
import { connect } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { HelpWizard } from '../HelpWizard/HelpWizard';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';
import { InspectContent } from './InspectContent';
import { useDatasourceMetadata, useInspectTabs } from './hooks';
const PanelInspectorUnconnected = ({ panel, dashboard, plugin }) => {
    const location = useLocation();
    const defaultTab = new URLSearchParams(location.search).get('inspectTab');
    const [dataOptions, setDataOptions] = useState({
        withTransforms: defaultTab === InspectTab.Error,
        withFieldConfig: true,
    });
    const { data, isLoading, hasError } = usePanelLatestData(panel, dataOptions, true);
    const metaDs = useDatasourceMetadata(data);
    const tabs = useInspectTabs(panel, dashboard, plugin, hasError, metaDs);
    const onClose = () => {
        locationService.partial({
            inspect: null,
            inspectTab: null,
        });
    };
    if (!plugin) {
        return null;
    }
    if (defaultTab === InspectTab.Help) {
        return React.createElement(HelpWizard, { panel: panel, plugin: plugin, onClose: onClose });
    }
    return (React.createElement(InspectContent, { dashboard: dashboard, panel: panel, plugin: plugin, defaultTab: defaultTab, tabs: tabs, data: data, isDataLoading: isLoading, dataOptions: dataOptions, onDataOptionsChange: setDataOptions, metadataDatasource: metaDs, onClose: onClose }));
};
const mapStateToProps = (state, props) => {
    const panelState = getPanelStateForModel(state, props.panel);
    if (!panelState) {
        return { plugin: null };
    }
    return {
        plugin: panelState.plugin,
    };
};
export const PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
//# sourceMappingURL=PanelInspector.js.map