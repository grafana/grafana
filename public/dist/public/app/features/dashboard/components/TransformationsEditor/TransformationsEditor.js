import { cx, css } from '@emotion/css';
import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { DocsId, standardTransformersRegistry, DataTransformerID, TransformationApplicabilityLevels, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, ConfirmModal, Container, CustomScrollbar, FilterPill, VerticalGroup, withTheme, Input, Icon, IconButton, useStyles2, Card, Switch, } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import config from 'app/core/config';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
import { categoriesLabels } from 'app/features/transformers/utils';
import { AppNotificationSeverity } from '../../../../types';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';
import { TransformationOperationRows } from './TransformationOperationRows';
const LOCAL_STORAGE_KEY = 'dashboard.components.TransformationEditor.featureInfoBox.isDismissed';
const viewAllValue = 'viewAll';
const viewAllLabel = 'View all';
const filterCategoriesLabels = [
    [viewAllValue, viewAllLabel],
    ...Object.entries(categoriesLabels),
];
class UnThemedTransformationsEditor extends React.PureComponent {
    constructor(props) {
        super(props);
        this.onSearchChange = (event) => {
            this.setState({ search: event.target.value });
        };
        this.onSearchKeyDown = (event) => {
            if (event.key === 'Enter') {
                const { search } = this.state;
                if (search) {
                    const lower = search.toLowerCase();
                    const filtered = standardTransformersRegistry.list().filter((t) => {
                        const txt = (t.name + t.description).toLowerCase();
                        return txt.indexOf(lower) >= 0;
                    });
                    if (filtered.length > 0) {
                        this.onTransformationAdd({ value: filtered[0].id });
                    }
                }
            }
            else if (event.keyCode === 27) {
                // Escape key
                this.setState({ search: '', showPicker: false });
                event.stopPropagation(); // don't exit the editor
            }
        };
        // Transformation UIDs are stored in a name-X form. name is NOT unique hence we need to parse the IDs and increase X
        // for transformations with the same name
        this.getTransformationNextId = (name) => {
            const { transformations } = this.state;
            let nextId = 0;
            const existingIds = transformations.filter((t) => t.id.startsWith(name)).map((t) => t.id);
            if (existingIds.length !== 0) {
                nextId = Math.max(...existingIds.map((i) => parseInt(i.match(/\d+/)[0], 10))) + 1;
            }
            return `${name}-${nextId}`;
        };
        this.onTransformationAdd = (selectable) => {
            let eventName = 'panel_editor_tabs_transformations_management';
            if (config.featureToggles.transformationsRedesign) {
                eventName = 'transformations_redesign_' + eventName;
            }
            reportInteraction(eventName, {
                action: 'add',
                transformationId: selectable.value,
            });
            const { transformations } = this.state;
            const nextId = this.getTransformationNextId(selectable.value);
            this.setState({ search: '', showPicker: false });
            this.onChange([
                ...transformations,
                {
                    id: nextId,
                    transformation: {
                        id: selectable.value,
                        options: {},
                    },
                },
            ]);
        };
        this.onTransformationChange = (idx, dataConfig) => {
            const { transformations } = this.state;
            const next = Array.from(transformations);
            let eventName = 'panel_editor_tabs_transformations_management';
            if (config.featureToggles.transformationsRedesign) {
                eventName = 'transformations_redesign_' + eventName;
            }
            reportInteraction(eventName, {
                action: 'change',
                transformationId: next[idx].transformation.id,
            });
            next[idx].transformation = dataConfig;
            this.onChange(next);
        };
        this.onTransformationRemove = (idx) => {
            const { transformations } = this.state;
            const next = Array.from(transformations);
            let eventName = 'panel_editor_tabs_transformations_management';
            if (config.featureToggles.transformationsRedesign) {
                eventName = 'transformations_redesign_' + eventName;
            }
            reportInteraction(eventName, {
                action: 'remove',
                transformationId: next[idx].transformation.id,
            });
            next.splice(idx, 1);
            this.onChange(next);
        };
        this.onTransformationRemoveAll = () => {
            this.onChange([]);
            this.setState({ showRemoveAllModal: false });
        };
        this.onDragEnd = (result) => {
            const { transformations } = this.state;
            if (!result || !result.destination) {
                return;
            }
            const startIndex = result.source.index;
            const endIndex = result.destination.index;
            if (startIndex === endIndex) {
                return;
            }
            const update = Array.from(transformations);
            const [removed] = update.splice(startIndex, 1);
            update.splice(endIndex, 0, removed);
            this.onChange(update);
        };
        this.renderTransformationEditors = () => {
            const styles = getStyles(config.theme2);
            const { data, transformations, showPicker } = this.state;
            const hide = config.featureToggles.transformationsRedesign && showPicker;
            return (React.createElement("div", { className: cx({ [styles.hide]: hide }) },
                React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
                    React.createElement(Droppable, { droppableId: "transformations-list", direction: "vertical" }, (provided) => {
                        return (React.createElement("div", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
                            React.createElement(TransformationOperationRows, { configs: transformations, data: data, onRemove: this.onTransformationRemove, onChange: this.onTransformationChange }),
                            provided.placeholder));
                    }))));
        };
        const transformations = props.panel.transformations || [];
        const ids = this.buildTransformationIds(transformations);
        this.state = {
            transformations: transformations.map((t, i) => ({
                transformation: t,
                id: ids[i],
            })),
            data: [],
            search: '',
            selectedFilter: viewAllValue,
            showIllustrations: true,
        };
    }
    buildTransformationIds(transformations) {
        const transformationCounters = {};
        const transformationIds = [];
        for (let i = 0; i < transformations.length; i++) {
            const transformation = transformations[i];
            if (transformationCounters[transformation.id] === undefined) {
                transformationCounters[transformation.id] = 0;
            }
            else {
                transformationCounters[transformation.id] += 1;
            }
            transformationIds.push(`${transformations[i].id}-${transformationCounters[transformations[i].id]}`);
        }
        return transformationIds;
    }
    componentDidMount() {
        this.subscription = this.props.panel
            .getQueryRunner()
            .getData({ withTransforms: false, withFieldConfig: false })
            .subscribe({
            next: (panelData) => this.setState({ data: panelData.series }),
        });
    }
    componentWillUnmount() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (config.featureToggles.transformationsRedesign) {
            const prevHasTransforms = prevState.transformations.length > 0;
            const prevShowPicker = !prevHasTransforms || prevState.showPicker;
            const currentHasTransforms = this.state.transformations.length > 0;
            const currentShowPicker = !currentHasTransforms || this.state.showPicker;
            if (prevShowPicker !== currentShowPicker) {
                // kindOfZero will be a random number between 0 and 0.5. It will be rounded to 0 by the scrollable component.
                // We cannot always use 0 as it will not trigger a rerender of the scrollable component consistently
                // due to React changes detection algo.
                const kindOfZero = Math.random() / 2;
                this.setState({ scrollTop: currentShowPicker ? kindOfZero : Number.MAX_SAFE_INTEGER });
            }
        }
    }
    onChange(transformations) {
        this.setState({ transformations });
        this.props.panel.setTransformations(transformations.map((t) => t.transformation));
    }
    renderTransformsPicker() {
        const styles = getStyles(config.theme2);
        const { transformations, search } = this.state;
        let suffix = null;
        let xforms = standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
        if (this.state.selectedFilter !== viewAllValue) {
            xforms = xforms.filter((t) => t.categories &&
                this.state.selectedFilter &&
                t.categories.has(this.state.selectedFilter));
        }
        if (search) {
            const lower = search.toLowerCase();
            const filtered = xforms.filter((t) => {
                const txt = (t.name + t.description).toLowerCase();
                return txt.indexOf(lower) >= 0;
            });
            suffix = (React.createElement(React.Fragment, null,
                filtered.length,
                " / ",
                xforms.length,
                " \u00A0\u00A0",
                React.createElement(IconButton, { name: "times", onClick: () => {
                        this.setState({ search: '' });
                    }, tooltip: "Clear search" })));
            xforms = filtered;
        }
        const noTransforms = !(transformations === null || transformations === void 0 ? void 0 : transformations.length);
        const showPicker = noTransforms || this.state.showPicker;
        if (!suffix && showPicker && !noTransforms) {
            suffix = (React.createElement(IconButton, { name: "times", onClick: () => {
                    this.setState({ showPicker: false });
                }, tooltip: "Close picker" }));
        }
        return (React.createElement(React.Fragment, null,
            noTransforms && !config.featureToggles.transformationsRedesign && (React.createElement(Container, { grow: 1 },
                React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: false }, (isDismissed, onDismiss) => {
                    if (isDismissed) {
                        return null;
                    }
                    return (React.createElement(Alert, { title: "Transformations", severity: "info", onRemove: () => {
                            onDismiss(true);
                        } },
                        React.createElement("p", null,
                            "Transformations allow you to join, calculate, re-order, hide, and rename your query results before they are visualized. ",
                            React.createElement("br", null),
                            "Many transforms are not suitable if you're using the Graph visualization, as it currently only supports time series data. ",
                            React.createElement("br", null),
                            "It can help to switch to the Table visualization to understand what a transformation is doing.",
                            ' '),
                        React.createElement("a", { href: getDocsLink(DocsId.Transformations), className: "external-link", target: "_blank", rel: "noreferrer" }, "Read more")));
                }))),
            showPicker ? (React.createElement(React.Fragment, null,
                config.featureToggles.transformationsRedesign && (React.createElement(React.Fragment, null,
                    !noTransforms && (React.createElement(Button, { variant: "secondary", fill: "text", icon: "angle-left", onClick: () => {
                            this.setState({ showPicker: false });
                        } },
                        "Go back to\u00A0",
                        React.createElement("i", null, "Transformations in use"))),
                    React.createElement("div", { className: styles.pickerInformationLine },
                        React.createElement("a", { href: getDocsLink(DocsId.Transformations), className: "external-link", target: "_blank", rel: "noreferrer" },
                            React.createElement("span", { className: styles.pickerInformationLineHighlight }, "Transformations"),
                            ' ',
                            React.createElement(Icon, { name: "external-link-alt" })),
                        "\u00A0allow you to manipulate your data before a visualization is applied."))),
                React.createElement(VerticalGroup, null,
                    !config.featureToggles.transformationsRedesign && (React.createElement(Input, { "data-testid": selectors.components.Transforms.searchInput, value: search !== null && search !== void 0 ? search : '', autoFocus: !noTransforms, placeholder: "Search for transformation", onChange: this.onSearchChange, onKeyDown: this.onSearchKeyDown, suffix: suffix })),
                    !config.featureToggles.transformationsRedesign &&
                        xforms.map((t) => {
                            return (React.createElement(TransformationCard, { key: t.name, transform: t, onClick: () => {
                                    this.onTransformationAdd({ value: t.id });
                                } }));
                        }),
                    config.featureToggles.transformationsRedesign && (React.createElement("div", { className: styles.searchWrapper },
                        React.createElement(Input, { "data-testid": selectors.components.Transforms.searchInput, className: styles.searchInput, value: search !== null && search !== void 0 ? search : '', autoFocus: !noTransforms, placeholder: "Search for transformation", onChange: this.onSearchChange, onKeyDown: this.onSearchKeyDown, suffix: suffix }),
                        React.createElement("div", { className: styles.showImages },
                            React.createElement("span", { className: styles.illustationSwitchLabel }, "Show images"),
                            ' ',
                            React.createElement(Switch, { value: this.state.showIllustrations, onChange: () => this.setState({ showIllustrations: !this.state.showIllustrations }) })))),
                    config.featureToggles.transformationsRedesign && (React.createElement("div", { className: styles.filterWrapper }, filterCategoriesLabels.map(([slug, label]) => {
                        return (React.createElement(FilterPill, { key: slug, onClick: () => this.setState({ selectedFilter: slug }), label: label, selected: this.state.selectedFilter === slug }));
                    }))),
                    config.featureToggles.transformationsRedesign && (React.createElement(TransformationsGrid, { showIllustrations: this.state.showIllustrations, transformations: xforms, data: this.state.data, onClick: (id) => {
                            this.onTransformationAdd({ value: id });
                        } }))))) : (React.createElement(Button, { icon: "plus", variant: "secondary", onClick: () => {
                    this.setState({ showPicker: true });
                }, "data-testid": selectors.components.Transforms.addTransformationButton },
                "Add",
                config.featureToggles.transformationsRedesign ? ' another ' : ' ',
                "transformation"))));
    }
    render() {
        const styles = getStyles(config.theme2);
        const { panel: { alert }, } = this.props;
        const { transformations } = this.state;
        const hasTransforms = transformations.length > 0;
        if (!hasTransforms && alert) {
            return React.createElement(PanelNotSupported, { message: "Transformations can't be used on a panel with existing alerts" });
        }
        return (React.createElement(CustomScrollbar, { scrollTop: this.state.scrollTop, autoHeightMin: "100%" },
            React.createElement(Container, { padding: "lg" },
                React.createElement("div", { "data-testid": selectors.components.TransformTab.content },
                    hasTransforms && alert ? (React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: "Transformations can't be used on a panel with alerts" })) : null,
                    hasTransforms && config.featureToggles.transformationsRedesign && !this.state.showPicker && (React.createElement("div", { className: styles.listInformationLineWrapper },
                        React.createElement("span", { className: styles.listInformationLineText }, "Transformations in use"),
                        ' ',
                        React.createElement(Button, { size: "sm", variant: "secondary", onClick: () => {
                                this.setState({ showRemoveAllModal: true });
                            } }, "Delete all transformations"),
                        React.createElement(ConfirmModal, { isOpen: Boolean(this.state.showRemoveAllModal), title: "Delete all transformations?", body: "By deleting all transformations, you will go back to the main selection screen.", confirmText: "Delete all", onConfirm: () => this.onTransformationRemoveAll(), onDismiss: () => this.setState({ showRemoveAllModal: false }) }))),
                    hasTransforms && this.renderTransformationEditors(),
                    this.renderTransformsPicker()))));
    }
}
function TransformationCard({ transform, onClick }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(Card, { className: styles.card, "data-testid": selectors.components.TransformTab.newTransform(transform.name), onClick: onClick },
        React.createElement(Card.Heading, null, transform.name),
        React.createElement(Card.Description, null, transform.description),
        transform.state && (React.createElement(Card.Tags, null,
            React.createElement(PluginStateInfo, { state: transform.state })))));
}
const getStyles = (theme) => {
    return {
        hide: css({
            display: 'none',
        }),
        card: css({
            margin: '0',
            padding: `${theme.spacing(1)}`,
        }),
        grid: css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gridAutoRows: '1fr',
            gap: `${theme.spacing(2)} ${theme.spacing(1)}`,
            width: '100%',
        }),
        newCard: css({
            gridTemplateRows: 'min-content 0 1fr 0',
        }),
        cardDisabled: css({
            backgroundColor: 'rgb(204, 204, 220, 0.045)',
            color: `${theme.colors.text.disabled} !important`,
        }),
        heading: css `
      font-weight: 400,
      > button: {
        width: '100%',
        display: 'flex',
        justify-content: 'space-between',
        align-items: 'center',
        flex-wrap: 'no-wrap',
      },
    `,
        description: css({
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
        }),
        image: css({
            display: 'block',
            maxEidth: '100%`',
            marginTop: `${theme.spacing(2)}`,
        }),
        searchWrapper: css({
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: '27px',
            rowGap: '16px',
            width: '100%',
        }),
        searchInput: css({
            flexGrow: '1',
            width: 'initial',
        }),
        showImages: css({
            flexBasis: '0',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
        }),
        pickerInformationLine: css({
            fontSize: '16px',
            marginBottom: `${theme.spacing(2)}`,
        }),
        pickerInformationLineHighlight: css({
            verticalAlign: 'middle',
        }),
        illustationSwitchLabel: css({
            whiteSpace: 'nowrap',
        }),
        filterWrapper: css({
            padding: `${theme.spacing(1)} 0`,
            display: 'flex',
            flexWrap: 'wrap',
            rowGap: `${theme.spacing(1)}`,
            columnGap: `${theme.spacing(0.5)}`,
        }),
        listInformationLineWrapper: css({
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '24px',
        }),
        listInformationLineText: css({
            fontSize: '16px',
        }),
        pluginStateInfoWrapper: css({
            marginLeft: '5px',
        }),
        cardApplicableInfo: css({
            position: 'absolute',
            bottom: `${theme.spacing(1)}`,
            right: `${theme.spacing(1)}`,
        }),
    };
};
function TransformationsGrid({ showIllustrations, transformations, onClick, data }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.grid }, transformations.map((transform) => {
        // Check to see if the transform
        // is applicable to the given data
        let applicabilityScore = TransformationApplicabilityLevels.Applicable;
        if (transform.transformation.isApplicable !== undefined) {
            applicabilityScore = transform.transformation.isApplicable(data);
        }
        const isApplicable = applicabilityScore > 0;
        let applicabilityDescription = null;
        if (transform.transformation.isApplicableDescription !== undefined) {
            if (typeof transform.transformation.isApplicableDescription === 'function') {
                applicabilityDescription = transform.transformation.isApplicableDescription(data);
            }
            else {
                applicabilityDescription = transform.transformation.isApplicableDescription;
            }
        }
        // Add disabled styles to disabled
        let cardClasses = styles.newCard;
        if (!isApplicable) {
            cardClasses = cx(styles.newCard, styles.cardDisabled);
        }
        return (React.createElement(Card, { className: cardClasses, "data-testid": selectors.components.TransformTab.newTransform(transform.name), onClick: () => onClick(transform.id), key: transform.id },
            React.createElement(Card.Heading, { className: styles.heading },
                React.createElement(React.Fragment, null,
                    React.createElement("span", null, transform.name),
                    React.createElement("span", { className: styles.pluginStateInfoWrapper },
                        React.createElement(PluginStateInfo, { state: transform.state })))),
            React.createElement(Card.Description, { className: styles.description },
                React.createElement(React.Fragment, null,
                    React.createElement("span", null, getTransformationsRedesignDescriptions(transform.id)),
                    showIllustrations && (React.createElement("span", null,
                        React.createElement("img", { className: styles.image, src: getImagePath(transform.id, !isApplicable), alt: transform.name }))),
                    !isApplicable && applicabilityDescription !== null && (React.createElement(IconButton, { className: styles.cardApplicableInfo, name: "info-circle", tooltip: applicabilityDescription }))))));
    })));
}
const getImagePath = (id, disabled) => {
    let folder = null;
    if (!disabled) {
        folder = config.theme2.isDark ? 'dark' : 'light';
    }
    else {
        folder = 'disabled';
    }
    return `public/img/transformations/${folder}/${id}.svg`;
};
const getTransformationsRedesignDescriptions = (id) => {
    var _a;
    const overrides = {
        [DataTransformerID.concatenate]: 'Combine all fields into a single frame.',
        [DataTransformerID.configFromData]: 'Set unit, min, max and more.',
        [DataTransformerID.fieldLookup]: 'Use a field value to lookup countries, states, or airports.',
        [DataTransformerID.filterFieldsByName]: 'Remove parts of the query results using a regex pattern.',
        [DataTransformerID.filterByRefId]: 'Remove rows from the data based on origin query',
        [DataTransformerID.filterByValue]: 'Remove rows from the query results using user-defined filters.',
        [DataTransformerID.groupBy]: 'Group data by a field value and create aggregate data.',
        [DataTransformerID.groupingToMatrix]: 'Summarize and reorganize data based on three fields.',
        [DataTransformerID.joinByField]: 'Combine rows from 2+ tables, based on a related field.',
        [DataTransformerID.labelsToFields]: 'Group series by time and return labels or tags as fields.',
        [DataTransformerID.merge]: 'Merge multiple series. Values will be combined into one row.',
        [DataTransformerID.organize]: 'Re-order, hide, or rename fields.',
        [DataTransformerID.partitionByValues]: 'Split a one-frame dataset into multiple series.',
        [DataTransformerID.prepareTimeSeries]: 'Stretch data frames from the wide format into the long format.',
        [DataTransformerID.reduce]: 'Reduce all rows or data points to a single value (ex. max, mean).',
        [DataTransformerID.renameByRegex]: 'Rename parts of the query results using a regular expression and replacement pattern.',
        [DataTransformerID.seriesToRows]: 'Merge multiple series. Return time, metric and values as a row.',
    };
    return overrides[id] || ((_a = standardTransformersRegistry.getIfExists(id)) === null || _a === void 0 ? void 0 : _a.description) || '';
};
export const TransformationsEditor = withTheme(UnThemedTransformationsEditor);
//# sourceMappingURL=TransformationsEditor.js.map