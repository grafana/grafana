import { css } from '@emotion/css';
import React from 'react';
import { LoadingPlaceholder, Pagination, Spinner, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { flattenGrafanaManagedRules } from '../../hooks/useCombinedRuleNamespaces';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';
export const GrafanaRules = ({ namespaces, expandAll }) => {
    const styles = useStyles2(getStyles);
    const [queryParams] = useQueryParams();
    const { prom, ruler } = useUnifiedAlertingSelector((state) => ({
        prom: state.promRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState,
        ruler: state.rulerRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState,
    }));
    const loading = prom.loading || ruler.loading;
    const hasResult = !!prom.result || !!ruler.result;
    const wantsListView = queryParams['view'] === 'list';
    const namespacesFormat = wantsListView ? flattenGrafanaManagedRules(namespaces) : namespaces;
    const groupsWithNamespaces = useCombinedGroupNamespace(namespacesFormat);
    const { numberOfPages, onPageChange, page, pageItems } = usePagination(groupsWithNamespaces, 1, DEFAULT_PER_PAGE_PAGINATION);
    return (React.createElement("section", { className: styles.wrapper },
        React.createElement("div", { className: styles.sectionHeader },
            React.createElement("h5", null, "Grafana"),
            loading ? React.createElement(LoadingPlaceholder, { className: styles.loader, text: "Loading..." }) : React.createElement("div", null)),
        pageItems.map(({ group, namespace }) => (React.createElement(RulesGroup, { group: group, key: `${namespace.name}-${group.name}`, namespace: namespace, expandAll: expandAll, viewMode: wantsListView ? 'list' : 'grouped' }))),
        hasResult && (namespacesFormat === null || namespacesFormat === void 0 ? void 0 : namespacesFormat.length) === 0 && React.createElement("p", null, "No rules found."),
        !hasResult && loading && React.createElement(Spinner, { size: 24, className: styles.spinner }),
        React.createElement(Pagination, { className: styles.pagination, currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true })));
};
const getStyles = (theme) => ({
    loader: css `
    margin-bottom: 0;
  `,
    sectionHeader: css `
    display: flex;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1)};
  `,
    wrapper: css `
    margin-bottom: ${theme.spacing(4)};
  `,
    spinner: css `
    text-align: center;
    padding: ${theme.spacing(2)};
  `,
    pagination: getPaginationStyles(theme),
});
//# sourceMappingURL=GrafanaRules.js.map