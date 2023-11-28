import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useMemo } from 'react';
import { LoadingPlaceholder, Pagination, Spinner, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { getRulesDataSources, getRulesSourceUid } from '../../utils/datasource';
import { isAsyncRequestStatePending } from '../../utils/redux';
import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';
export const CloudRules = ({ namespaces, expandAll }) => {
    const styles = useStyles2(getStyles);
    const dsConfigs = useUnifiedAlertingSelector((state) => state.dataSources);
    const promRules = useUnifiedAlertingSelector((state) => state.promRules);
    const rulesDataSources = useMemo(getRulesDataSources, []);
    const groupsWithNamespaces = useCombinedGroupNamespace(namespaces);
    const dataSourcesLoading = useMemo(() => rulesDataSources.filter((ds) => isAsyncRequestStatePending(promRules[ds.name]) || isAsyncRequestStatePending(dsConfigs[ds.name])), [promRules, dsConfigs, rulesDataSources]);
    const hasSomeResults = rulesDataSources.some((ds) => { var _a, _b; return Boolean((_b = (_a = promRules[ds.name]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.length); });
    const hasDataSourcesConfigured = rulesDataSources.length > 0;
    const hasDataSourcesLoading = dataSourcesLoading.length > 0;
    const hasNamespaces = namespaces.length > 0;
    const { numberOfPages, onPageChange, page, pageItems } = usePagination(groupsWithNamespaces, 1, DEFAULT_PER_PAGE_PAGINATION);
    return (React.createElement("section", { className: styles.wrapper },
        React.createElement("div", { className: styles.sectionHeader },
            React.createElement("h5", null, "Mimir / Cortex / Loki"),
            dataSourcesLoading.length ? (React.createElement(LoadingPlaceholder, { className: styles.loader, text: `Loading rules from ${dataSourcesLoading.length} ${pluralize('source', dataSourcesLoading.length)}` })) : (React.createElement("div", null))),
        pageItems.map(({ group, namespace }) => {
            return (React.createElement(RulesGroup, { group: group, key: `${getRulesSourceUid(namespace.rulesSource)}-${namespace.name}-${group.name}`, namespace: namespace, expandAll: expandAll, viewMode: 'grouped' }));
        }),
        !hasDataSourcesConfigured && React.createElement("p", null, "There are no Prometheus or Loki data sources configured."),
        hasDataSourcesConfigured && !hasDataSourcesLoading && !hasNamespaces && React.createElement("p", null, "No rules found."),
        !hasSomeResults && hasDataSourcesLoading && React.createElement(Spinner, { size: 24, className: styles.spinner }),
        React.createElement(Pagination, { className: styles.pagination, currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true })));
};
const getStyles = (theme) => ({
    loader: css `
    margin-bottom: 0;
  `,
    sectionHeader: css `
    display: flex;
    justify-content: space-between;
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
//# sourceMappingURL=CloudRules.js.map