import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { Input, Modal, MultiSelect, Spinner, useTheme2, Pagination, Button, Toggletip, ButtonGroup, Icon, } from '@grafana/ui';
import { AdditionalSettings } from './AdditionalSettings';
import { FeedbackLink } from './FeedbackLink';
import { ResultsTable } from './ResultsTable';
import { calculatePageList, calculateResultsPerPage, displayedMetrics, getBackendSearchMetrics, setMetrics, placeholders, promTypes, tracking, } from './state/helpers';
import { DEFAULT_RESULTS_PER_PAGE, initialState, MAXIMUM_RESULTS_PER_PAGE, stateSlice, } from './state/state';
import { getStyles } from './styles';
import { debouncedFuzzySearch } from './uFuzzy';
// actions to update the state
const { setIsLoading, buildMetrics, filterMetricsBackend, setResultsPerPage, setPageNum, setFuzzySearchQuery, setNameHaystack, setMetaHaystack, setFullMetaSearch, setIncludeNullMetadata, setSelectedTypes, setUseBackend, setDisableTextWrap, showAdditionalSettings, } = stateSlice.actions;
export const MetricsModal = (props) => {
    var _a;
    const { datasource, isOpen, onClose, onChange, query, initialMetrics } = props;
    const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query));
    const theme = useTheme2();
    const styles = getStyles(theme, state.disableTextWrap);
    /**
     * loads metrics and metadata on opening modal and switching off useBackend
     */
    const updateMetricsMetadata = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        // *** Loading Gif
        dispatch(setIsLoading(true));
        const data = yield setMetrics(datasource, query, initialMetrics);
        dispatch(buildMetrics({
            isLoading: false,
            hasMetadata: data.hasMetadata,
            metrics: data.metrics,
            metaHaystackDictionary: data.metaHaystackDictionary,
            nameHaystackDictionary: data.nameHaystackDictionary,
            totalMetricCount: data.metrics.length,
            filteredMetricCount: data.metrics.length,
        }));
    }), [query, datasource, initialMetrics]);
    useEffect(() => {
        updateMetricsMetadata();
    }, [updateMetricsMetadata]);
    const typeOptions = promTypes.map((t) => {
        return {
            value: t.value,
            label: t.value,
            description: t.description,
        };
    });
    /**
     * The backend debounced search
     */
    const debouncedBackendSearch = useMemo(() => debounce((metricText) => __awaiter(void 0, void 0, void 0, function* () {
        dispatch(setIsLoading(true));
        const metrics = yield getBackendSearchMetrics(metricText, query.labels, datasource);
        dispatch(filterMetricsBackend({
            metrics: metrics,
            filteredMetricCount: metrics.length,
            isLoading: false,
        }));
    }), datasource.getDebounceTimeInMilliseconds()), [datasource, query]);
    function fuzzyNameDispatch(haystackData) {
        dispatch(setNameHaystack(haystackData));
    }
    function fuzzyMetaDispatch(haystackData) {
        dispatch(setMetaHaystack(haystackData));
    }
    function searchCallback(query, fullMetaSearchVal) {
        if (state.useBackend && query === '') {
            // get all metrics data if a user erases everything in the input
            updateMetricsMetadata();
        }
        else if (state.useBackend) {
            debouncedBackendSearch(query);
        }
        else {
            // search either the names or all metadata
            // fuzzy search go!
            if (fullMetaSearchVal) {
                debouncedFuzzySearch(Object.keys(state.metaHaystackDictionary), query, fuzzyMetaDispatch);
            }
            else {
                debouncedFuzzySearch(Object.keys(state.nameHaystackDictionary), query, fuzzyNameDispatch);
            }
        }
    }
    /* Settings switches */
    const additionalSettings = (React.createElement(AdditionalSettings, { state: state, onChangeFullMetaSearch: () => {
            const newVal = !state.fullMetaSearch;
            dispatch(setFullMetaSearch(newVal));
            onChange(Object.assign(Object.assign({}, query), { fullMetaSearch: newVal }));
            searchCallback(state.fuzzySearchQuery, newVal);
        }, onChangeIncludeNullMetadata: () => {
            dispatch(setIncludeNullMetadata(!state.includeNullMetadata));
            onChange(Object.assign(Object.assign({}, query), { includeNullMetadata: !state.includeNullMetadata }));
        }, onChangeDisableTextWrap: () => {
            dispatch(setDisableTextWrap());
            onChange(Object.assign(Object.assign({}, query), { disableTextWrap: !state.disableTextWrap }));
            tracking('grafana_prom_metric_encycopedia_disable_text_wrap_interaction', state, '');
        }, onChangeUseBackend: () => {
            const newVal = !state.useBackend;
            dispatch(setUseBackend(newVal));
            onChange(Object.assign(Object.assign({}, query), { useBackend: newVal }));
            if (newVal === false) {
                // rebuild the metrics metadata if we turn off useBackend
                updateMetricsMetadata();
            }
            else {
                // check if there is text in the browse search and update
                if (state.fuzzySearchQuery !== '') {
                    debouncedBackendSearch(state.fuzzySearchQuery);
                }
                // otherwise wait for user typing
            }
        } }));
    return (React.createElement(Modal, { "data-testid": testIds.metricModal, isOpen: isOpen, title: "Metrics explorer", onDismiss: onClose, "aria-label": "Browse metrics", className: styles.modal },
        React.createElement(FeedbackLink, { feedbackUrl: "https://forms.gle/DEMAJHoAMpe3e54CA" }),
        React.createElement("div", { className: styles.inputWrapper },
            React.createElement("div", { className: cx(styles.inputItem, styles.inputItemFirst) },
                React.createElement(Input, { autoFocus: true, "data-testid": testIds.searchMetric, placeholder: placeholders.browse, value: state.fuzzySearchQuery, onInput: (e) => {
                        var _a;
                        const value = (_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : '';
                        dispatch(setFuzzySearchQuery(value));
                        searchCallback(value, state.fullMetaSearch);
                    } })),
            state.hasMetadata && (React.createElement("div", { className: styles.inputItem },
                React.createElement(MultiSelect, { "data-testid": testIds.selectType, inputId: "my-select", options: typeOptions, value: state.selectedTypes, placeholder: placeholders.type, onChange: (v) => dispatch(setSelectedTypes(v)) }))),
            React.createElement("div", null,
                React.createElement(Spinner, { className: `${styles.loadingSpinner} ${state.isLoading ? styles.visible : ''}` })),
            React.createElement("div", { className: styles.inputItem },
                React.createElement(Toggletip, { "aria-label": "Additional settings", content: additionalSettings, placement: "bottom-end", closeButton: false },
                    React.createElement(ButtonGroup, { className: styles.settingsBtn },
                        React.createElement(Button, { variant: "secondary", size: "md", onClick: () => dispatch(showAdditionalSettings()), "data-testid": testIds.showAdditionalSettings, className: styles.noBorder }, "Additional Settings"),
                        React.createElement(Button, { className: styles.noBorder, variant: "secondary", icon: state.showAdditionalSettings ? 'angle-up' : 'angle-down' }))))),
        React.createElement("div", { className: styles.resultsData },
            query.metric && React.createElement("i", { className: styles.currentlySelected },
                "Currently selected: ",
                query.metric),
            query.labels.length > 0 && (React.createElement("div", { className: styles.resultsDataFiltered },
                React.createElement(Icon, { name: "info-circle", size: "sm" }),
                React.createElement("div", { className: styles.resultsDataFilteredText }, "\u00A0These metrics have been pre-filtered by labels chosen in the label filters.")))),
        React.createElement("div", { className: styles.results }, state.metrics && (React.createElement(ResultsTable, { metrics: displayedMetrics(state, dispatch), onChange: onChange, onClose: onClose, query: query, state: state, disableTextWrap: state.disableTextWrap }))),
        React.createElement("div", { className: styles.resultsFooter },
            React.createElement("div", { className: styles.resultsAmount },
                "Showing ",
                state.filteredMetricCount,
                " of ",
                state.totalMetricCount,
                " results"),
            React.createElement(Pagination, { currentPage: (_a = state.pageNum) !== null && _a !== void 0 ? _a : 1, numberOfPages: calculatePageList(state).length, onNavigate: (val) => {
                    const page = val !== null && val !== void 0 ? val : 1;
                    dispatch(setPageNum(page));
                } }),
            React.createElement("div", { className: styles.resultsPerPageWrapper },
                React.createElement("p", { className: styles.resultsPerPageLabel }, "# Results per page\u00A0"),
                React.createElement(Input, { "data-testid": testIds.resultsPerPage, value: calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE), placeholder: "results per page", width: 10, title: 'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE, type: "number", onInput: (e) => {
                        const value = +e.currentTarget.value;
                        if (isNaN(value) || value >= MAXIMUM_RESULTS_PER_PAGE) {
                            return;
                        }
                        dispatch(setResultsPerPage(value));
                    } })))));
};
export const testIds = {
    metricModal: 'metric-modal',
    searchMetric: 'search-metric',
    searchWithMetadata: 'search-with-metadata',
    selectType: 'select-type',
    metricCard: 'metric-card',
    useMetric: 'use-metric',
    searchPage: 'search-page',
    resultsPerPage: 'results-per-page',
    setUseBackend: 'set-use-backend',
    showAdditionalSettings: 'show-additional-settings',
};
//# sourceMappingURL=MetricsModal.js.map