import { __assign, __extends, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { Alert, Button, Container, CustomScrollbar, VerticalGroup, withTheme, Input, IconButton, useStyles2, Card, } from '@grafana/ui';
import { DocsId, standardTransformersRegistry, } from '@grafana/data';
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { TransformationOperationRows } from './TransformationOperationRows';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';
import { AppNotificationSeverity } from '../../../../types';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
var LOCAL_STORAGE_KEY = 'dashboard.components.TransformationEditor.featureInfoBox.isDismissed';
var UnThemedTransformationsEditor = /** @class */ (function (_super) {
    __extends(UnThemedTransformationsEditor, _super);
    function UnThemedTransformationsEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onSearchChange = function (event) {
            _this.setState({ search: event.target.value });
        };
        _this.onSearchKeyDown = function (event) {
            if (event.key === 'Enter') {
                var search = _this.state.search;
                if (search) {
                    var lower_1 = search.toLowerCase();
                    var filtered = standardTransformersRegistry.list().filter(function (t) {
                        var txt = (t.name + t.description).toLowerCase();
                        return txt.indexOf(lower_1) >= 0;
                    });
                    if (filtered.length > 0) {
                        _this.onTransformationAdd({ value: filtered[0].id });
                    }
                }
            }
            else if (event.keyCode === 27) {
                // Escape key
                _this.setState({ search: '', showPicker: false });
                event.stopPropagation(); // don't exit the editor
            }
        };
        // Transformation UIDs are stored in a name-X form. name is NOT unique hence we need to parse the IDs and increase X
        // for transformations with the same name
        _this.getTransformationNextId = function (name) {
            var transformations = _this.state.transformations;
            var nextId = 0;
            var existingIds = transformations.filter(function (t) { return t.id.startsWith(name); }).map(function (t) { return t.id; });
            if (existingIds.length !== 0) {
                nextId = Math.max.apply(Math, __spreadArray([], __read(existingIds.map(function (i) { return parseInt(i.match(/\d+/)[0], 10); })), false)) + 1;
            }
            return name + "-" + nextId;
        };
        _this.onTransformationAdd = function (selectable) {
            var transformations = _this.state.transformations;
            var nextId = _this.getTransformationNextId(selectable.value);
            _this.setState({ search: '', showPicker: false });
            _this.onChange(__spreadArray(__spreadArray([], __read(transformations), false), [
                {
                    id: nextId,
                    transformation: {
                        id: selectable.value,
                        options: {},
                    },
                },
            ], false));
        };
        _this.onTransformationChange = function (idx, config) {
            var transformations = _this.state.transformations;
            var next = Array.from(transformations);
            next[idx].transformation = config;
            _this.onChange(next);
        };
        _this.onTransformationRemove = function (idx) {
            var transformations = _this.state.transformations;
            var next = Array.from(transformations);
            next.splice(idx, 1);
            _this.onChange(next);
        };
        _this.onDragEnd = function (result) {
            var transformations = _this.state.transformations;
            if (!result || !result.destination) {
                return;
            }
            var startIndex = result.source.index;
            var endIndex = result.destination.index;
            if (startIndex === endIndex) {
                return;
            }
            var update = Array.from(transformations);
            var _a = __read(update.splice(startIndex, 1), 1), removed = _a[0];
            update.splice(endIndex, 0, removed);
            _this.onChange(update);
        };
        _this.renderTransformationEditors = function () {
            var _a = _this.state, data = _a.data, transformations = _a.transformations;
            return (React.createElement(DragDropContext, { onDragEnd: _this.onDragEnd },
                React.createElement(Droppable, { droppableId: "transformations-list", direction: "vertical" }, function (provided) {
                    return (React.createElement("div", __assign({ ref: provided.innerRef }, provided.droppableProps),
                        React.createElement(TransformationOperationRows, { configs: transformations, data: data, onRemove: _this.onTransformationRemove, onChange: _this.onTransformationChange }),
                        provided.placeholder));
                })));
        };
        var transformations = props.panel.transformations || [];
        var ids = _this.buildTransformationIds(transformations);
        _this.state = {
            transformations: transformations.map(function (t, i) { return ({
                transformation: t,
                id: ids[i],
            }); }),
            data: [],
            search: '',
        };
        return _this;
    }
    UnThemedTransformationsEditor.prototype.buildTransformationIds = function (transformations) {
        var transformationCounters = {};
        var transformationIds = [];
        for (var i = 0; i < transformations.length; i++) {
            var transformation = transformations[i];
            if (transformationCounters[transformation.id] === undefined) {
                transformationCounters[transformation.id] = 0;
            }
            else {
                transformationCounters[transformation.id] += 1;
            }
            transformationIds.push(transformations[i].id + "-" + transformationCounters[transformations[i].id]);
        }
        return transformationIds;
    };
    UnThemedTransformationsEditor.prototype.componentDidMount = function () {
        var _this = this;
        this.subscription = this.props.panel
            .getQueryRunner()
            .getData({ withTransforms: false, withFieldConfig: false })
            .subscribe({
            next: function (panelData) { return _this.setState({ data: panelData.series }); },
        });
    };
    UnThemedTransformationsEditor.prototype.componentWillUnmount = function () {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    };
    UnThemedTransformationsEditor.prototype.onChange = function (transformations) {
        this.setState({ transformations: transformations });
        this.props.panel.setTransformations(transformations.map(function (t) { return t.transformation; }));
    };
    UnThemedTransformationsEditor.prototype.renderTransformsPicker = function () {
        var _this = this;
        var _a = this.state, transformations = _a.transformations, search = _a.search;
        var suffix = null;
        var xforms = standardTransformersRegistry.list().sort(function (a, b) { return (a.name > b.name ? 1 : b.name > a.name ? -1 : 0); });
        if (search) {
            var lower_2 = search.toLowerCase();
            var filtered = xforms.filter(function (t) {
                var txt = (t.name + t.description).toLowerCase();
                return txt.indexOf(lower_2) >= 0;
            });
            suffix = (React.createElement(React.Fragment, null,
                filtered.length,
                " / ",
                xforms.length,
                " \u00A0\u00A0",
                React.createElement(IconButton, { name: "times", surface: "header", onClick: function () {
                        _this.setState({ search: '' });
                    } })));
            xforms = filtered;
        }
        var noTransforms = !(transformations === null || transformations === void 0 ? void 0 : transformations.length);
        var showPicker = noTransforms || this.state.showPicker;
        if (!suffix && showPicker && !noTransforms) {
            suffix = (React.createElement(IconButton, { name: "times", surface: "header", onClick: function () {
                    _this.setState({ showPicker: false });
                } }));
        }
        return (React.createElement(React.Fragment, null,
            noTransforms && (React.createElement(Container, { grow: 1 },
                React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: false }, function (isDismissed, onDismiss) {
                    if (isDismissed) {
                        return null;
                    }
                    return (React.createElement(Alert, { title: "Transformations", severity: "info", onRemove: function () {
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
            showPicker ? (React.createElement(VerticalGroup, null,
                React.createElement(Input, { "aria-label": selectors.components.Transforms.searchInput, value: search !== null && search !== void 0 ? search : '', autoFocus: !noTransforms, placeholder: "Add transformation", onChange: this.onSearchChange, onKeyDown: this.onSearchKeyDown, suffix: suffix }),
                xforms.map(function (t) {
                    return (React.createElement(TransformationCard, { key: t.name, transform: t, onClick: function () {
                            _this.onTransformationAdd({ value: t.id });
                        } }));
                }))) : (React.createElement(Button, { icon: "plus", variant: "secondary", onClick: function () {
                    _this.setState({ showPicker: true });
                } }, "Add transformation"))));
    };
    UnThemedTransformationsEditor.prototype.render = function () {
        var alert = this.props.panel.alert;
        var transformations = this.state.transformations;
        var hasTransforms = transformations.length > 0;
        if (!hasTransforms && alert) {
            return React.createElement(PanelNotSupported, { message: "Transformations can't be used on a panel with existing alerts" });
        }
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            React.createElement(Container, { padding: "md" },
                React.createElement("div", { "aria-label": selectors.components.TransformTab.content },
                    hasTransforms && alert ? (React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: "Transformations can't be used on a panel with alerts" })) : null,
                    hasTransforms && this.renderTransformationEditors(),
                    this.renderTransformsPicker()))));
    };
    return UnThemedTransformationsEditor;
}(React.PureComponent));
function TransformationCard(_a) {
    var transform = _a.transform, onClick = _a.onClick;
    var styles = useStyles2(getStyles);
    return (React.createElement(Card, { className: styles.card, heading: transform.name, "aria-label": selectors.components.TransformTab.newTransform(transform.name), onClick: onClick },
        React.createElement(Card.Meta, null, transform.description),
        transform.state && (React.createElement(Card.Tags, null,
            React.createElement(PluginStateInfo, { state: transform.state })))));
}
var getStyles = function (theme) {
    return {
        card: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin: 0;\n\n      > div {\n        padding: ", ";\n      }\n    "], ["\n      margin: 0;\n\n      > div {\n        padding: ", ";\n      }\n    "])), theme.spacing(1)),
    };
};
export var TransformationsEditor = withTheme(UnThemedTransformationsEditor);
var templateObject_1;
//# sourceMappingURL=TransformationsEditor.js.map