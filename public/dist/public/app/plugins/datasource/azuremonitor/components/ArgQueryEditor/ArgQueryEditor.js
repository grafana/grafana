import { intersection } from 'lodash';
import React, { useState, useMemo } from 'react';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { selectors } from '../../e2e/selectors';
import QueryField from './QueryField';
import SubscriptionField from './SubscriptionField';
const ERROR_SOURCE = 'arg-subscriptions';
function selectSubscriptions(fetchedSubscriptions, currentSubscriptions, currentSubscription) {
    let querySubscriptions = currentSubscriptions || [];
    if (querySubscriptions.length === 0 && currentSubscription) {
        querySubscriptions = [currentSubscription];
    }
    if (querySubscriptions.length === 0 && fetchedSubscriptions.length) {
        querySubscriptions = [fetchedSubscriptions[0]];
    }
    const templateVars = querySubscriptions.filter((sub) => sub.includes('$'));
    const commonSubscriptions = intersection(querySubscriptions, fetchedSubscriptions).concat(templateVars);
    if (fetchedSubscriptions.length && querySubscriptions.length > commonSubscriptions.length) {
        // If not all of the query subscriptions are in the list of fetched subscriptions, then
        // select only the ones present (or the first one if none is present)
        querySubscriptions = commonSubscriptions.length > 0 ? commonSubscriptions : [fetchedSubscriptions[0]];
    }
    return querySubscriptions;
}
const ArgQueryEditor = ({ query, datasource, subscriptionId, variableOptionGroup, onChange, setError, }) => {
    const [subscriptions, setSubscriptions] = useState([]);
    useMemo(() => {
        datasource
            .getSubscriptions()
            .then((results) => {
            const fetchedSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
            setSubscriptions(fetchedSubscriptions);
            setError(ERROR_SOURCE, undefined);
            onChange(Object.assign(Object.assign({}, query), { subscriptions: selectSubscriptions(fetchedSubscriptions.map((v) => v.value), query.subscriptions, query.subscription) }));
        })
            .catch((err) => setError(ERROR_SOURCE, err));
        // We are only interested in re-fetching subscriptions if the data source changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datasource]);
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.argsQueryEditor.container.input },
        React.createElement(EditorRows, null,
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(SubscriptionField, { subscriptions: subscriptions, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })))),
        React.createElement(QueryField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })));
};
export default ArgQueryEditor;
//# sourceMappingURL=ArgQueryEditor.js.map