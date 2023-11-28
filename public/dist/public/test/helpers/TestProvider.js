import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { locationService } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';
/**
 * Wrapps component in redux store provider, Router and GrafanaContext
 */
export function TestProvider(props) {
    const { store = configureStore(props.storeState), children } = props;
    const context = Object.assign(Object.assign({}, getGrafanaContextMock()), props.grafanaContext);
    return (React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(GrafanaContext.Provider, { value: context }, children))));
}
//# sourceMappingURL=TestProvider.js.map