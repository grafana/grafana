import { __rest } from "tslib";
import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, CustomScrollbar, Icon, Input, ModalsController, Portal, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { Trans } from 'app/core/internationalization';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { defaultFileUploadQuery } from 'app/plugins/datasource/grafana/types';
import { useDatasource } from '../../hooks';
import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { applyMaxSize, maxSize } from './popperModifiers';
import { dataSourceLabel, matchDataSourceWithSearch } from './utils';
const INTERACTION_EVENT_NAME = 'dashboards_dspicker_clicked';
const INTERACTION_ITEM = {
    OPEN_DROPDOWN: 'open_dspicker',
    SELECT_DS: 'select_ds',
    ADD_FILE: 'add_file',
    OPEN_ADVANCED_DS_PICKER: 'open_advanced_ds_picker',
    CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
};
export function DataSourceDropdown(props) {
    const { current, onChange, hideTextValue = false, width, inputId, noDefault = false, disabled = false, placeholder = 'Select data source' } = props, restProps = __rest(props, ["current", "onChange", "hideTextValue", "width", "inputId", "noDefault", "disabled", "placeholder"]);
    const styles = useStyles2(getStylesDropdown, props);
    const [isOpen, setOpen] = useState(false);
    const [inputHasFocus, setInputHasFocus] = useState(false);
    const [filterTerm, setFilterTerm] = useState('');
    const { onKeyDown, keyboardEvents } = useKeyNavigationListener();
    const ref = useRef(null);
    // Used to position the popper correctly and to bring back the focus when navigating from footer to input
    const [markerElement, setMarkerElement] = useState();
    // Used to position the popper correctly
    const [selectorElement, setSelectorElement] = useState();
    // Used to move the focus to the footer when tabbing from the input
    const [footerRef, setFooterRef] = useState();
    const currentDataSourceInstanceSettings = useDatasource(current);
    const grafanaDS = useDatasource('-- Grafana --');
    const currentValue = Boolean(!current && noDefault) ? undefined : currentDataSourceInstanceSettings;
    const prefixIcon = filterTerm && isOpen ? React.createElement(DataSourceLogoPlaceHolder, null) : React.createElement(DataSourceLogo, { dataSource: currentValue });
    const popper = usePopper(markerElement, selectorElement, {
        placement: 'bottom-start',
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: [0, 4],
                },
            },
            maxSize,
            applyMaxSize,
        ],
    });
    const onClose = useCallback(() => {
        setFilterTerm('');
        setOpen(false);
        markerElement === null || markerElement === void 0 ? void 0 : markerElement.focus();
    }, [setOpen, markerElement]);
    const { overlayProps, underlayProps } = useOverlay({
        onClose: onClose,
        isDismissable: true,
        isOpen,
        shouldCloseOnInteractOutside: (element) => {
            return markerElement ? !markerElement.isSameNode(element) : false;
        },
    }, ref);
    const { dialogProps } = useDialog({
        'aria-label': 'Opened data source picker list',
    }, ref);
    function openDropdown() {
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_DROPDOWN });
        setOpen(true);
        markerElement === null || markerElement === void 0 ? void 0 : markerElement.focus();
    }
    function onClickAddCSV() {
        if (!grafanaDS) {
            return;
        }
        onChange(grafanaDS, [defaultFileUploadQuery]);
    }
    function onKeyDownInput(keyEvent) {
        // From the input, it navigates to the footer
        if (keyEvent.key === 'Tab' && !keyEvent.shiftKey && isOpen) {
            keyEvent.preventDefault();
            footerRef === null || footerRef === void 0 ? void 0 : footerRef.focus();
        }
        // From the input, if we navigate back, it closes the dropdown
        if (keyEvent.key === 'Tab' && keyEvent.shiftKey && isOpen) {
            onClose();
        }
        onKeyDown(keyEvent);
    }
    function onNavigateOutsiteFooter(e) {
        // When navigating back, the dropdown keeps open and the input element is focused.
        if (e.shiftKey) {
            e.preventDefault();
            markerElement === null || markerElement === void 0 ? void 0 : markerElement.focus();
            // When navigating forward, the dropdown closes and and the element next to the input element is focused.
        }
        else {
            onClose();
        }
    }
    useEffect(() => {
        const sub = keyboardEvents.subscribe({
            next: (keyEvent) => {
                switch (keyEvent === null || keyEvent === void 0 ? void 0 : keyEvent.code) {
                    case 'ArrowDown':
                        openDropdown();
                        keyEvent.preventDefault();
                        break;
                    case 'ArrowUp':
                        openDropdown();
                        keyEvent.preventDefault();
                        break;
                    case 'Escape':
                        onClose();
                        keyEvent.preventDefault();
                        break;
                }
            },
        });
        return () => sub.unsubscribe();
    });
    return (React.createElement("div", { className: styles.container, "data-testid": selectors.components.DataSourcePicker.container },
        React.createElement("div", { className: styles.trigger, onClick: openDropdown },
            React.createElement(Input, { id: inputId || 'data-source-picker', className: inputHasFocus ? undefined : styles.input, "data-testid": selectors.components.DataSourcePicker.inputV2, "aria-label": "Select a data source", autoComplete: "off", prefix: currentValue ? prefixIcon : undefined, suffix: React.createElement(Icon, { name: isOpen ? 'search' : 'angle-down' }), placeholder: hideTextValue ? '' : dataSourceLabel(currentValue) || placeholder, onFocus: () => {
                    setInputHasFocus(true);
                }, onBlur: () => {
                    setInputHasFocus(false);
                }, onKeyDown: onKeyDownInput, value: filterTerm, onChange: (e) => {
                    openDropdown();
                    setFilterTerm(e.currentTarget.value);
                }, ref: setMarkerElement, disabled: disabled })),
        isOpen ? (React.createElement(Portal, null,
            React.createElement("div", Object.assign({}, underlayProps)),
            React.createElement("div", Object.assign({ ref: ref }, overlayProps, dialogProps),
                React.createElement(PickerContent, Object.assign({}, restProps, popper.attributes.popper, { style: popper.styles.popper, ref: setSelectorElement, footerRef: setFooterRef, current: currentValue, filterTerm: filterTerm, keyboardEvents: keyboardEvents, onChange: (ds, defaultQueries) => {
                        onClose();
                        if (ds.uid !== (currentValue === null || currentValue === void 0 ? void 0 : currentValue.uid)) {
                            onChange(ds, defaultQueries);
                            reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.SELECT_DS, ds_type: ds.type });
                        }
                    }, onClose: onClose, onClickAddCSV: onClickAddCSV, onDismiss: onClose, onNavigateOutsiteFooter: onNavigateOutsiteFooter }))))) : null));
}
function getStylesDropdown(theme, props) {
    return {
        container: css `
      position: relative;
      cursor: ${props.disabled ? 'not-allowed' : 'pointer'};
      width: ${theme.spacing(props.width || 'auto')};
    `,
        trigger: css `
      cursor: pointer;
      ${props.disabled && `pointer-events: none;`}
    `,
        input: css `
      input::placeholder {
        color: ${props.disabled ? theme.colors.action.disabledText : theme.colors.text.primary};
      }
    `,
    };
}
const PickerContent = React.forwardRef((props, ref) => {
    const { filterTerm, onChange, onClose, onClickAddCSV, current, filter } = props;
    const changeCallback = useCallback((ds) => {
        onChange(ds);
    }, [onChange]);
    const clickAddCSVCallback = useCallback(() => {
        onClickAddCSV === null || onClickAddCSV === void 0 ? void 0 : onClickAddCSV();
        onClose();
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.ADD_FILE });
    }, [onClickAddCSV, onClose]);
    const styles = useStyles2(getStylesPickerContent);
    return (React.createElement("div", { style: props.style, ref: ref, className: styles.container },
        React.createElement(CustomScrollbar, null,
            React.createElement(DataSourceList, Object.assign({}, props, { enableKeyboardNavigation: true, className: styles.dataSourceList, current: current, onChange: changeCallback, filter: (ds) => (filter ? filter === null || filter === void 0 ? void 0 : filter(ds) : true) && matchDataSourceWithSearch(ds, filterTerm), onClickEmptyStateCTA: () => reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                }) }))),
        React.createElement(FocusScope, null,
            React.createElement(Footer, Object.assign({}, props, { onClickAddCSV: clickAddCSVCallback, onChange: changeCallback, onNavigateOutsiteFooter: props.onNavigateOutsiteFooter })))));
});
PickerContent.displayName = 'PickerContent';
function getStylesPickerContent(theme) {
    return {
        container: css `
      display: flex;
      flex-direction: column;
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
    `,
        picker: css `
      background: ${theme.colors.background.secondary};
    `,
        dataSourceList: css `
      flex: 1;
    `,
        footer: css `
      flex: 0;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      padding: ${theme.spacing(1.5)};
      border-top: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
    `,
    };
}
function Footer(_a) {
    var { onClose, onChange, onClickAddCSV } = _a, props = __rest(_a, ["onClose", "onChange", "onClickAddCSV"]);
    const styles = useStyles2(getStylesFooter);
    const isUploadFileEnabled = props.uploadFile && config.featureToggles.editPanelCSVDragAndDrop;
    const onKeyDownLastButton = (e) => {
        if (e.key === 'Tab') {
            props.onNavigateOutsiteFooter(e);
        }
    };
    const onKeyDownFirstButton = (e) => {
        if (e.key === 'Tab' && e.shiftKey) {
            props.onNavigateOutsiteFooter(e);
        }
    };
    return (React.createElement("div", { className: styles.footer },
        React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { size: "sm", variant: "secondary", fill: "text", onClick: () => {
                onClose();
                showModal(DataSourceModal, {
                    reportedInteractionFrom: 'ds_picker',
                    tracing: props.tracing,
                    dashboard: props.dashboard,
                    mixed: props.mixed,
                    metrics: props.metrics,
                    type: props.type,
                    annotations: props.annotations,
                    variables: props.variables,
                    alerting: props.alerting,
                    pluginId: props.pluginId,
                    logs: props.logs,
                    filter: props.filter,
                    uploadFile: props.uploadFile,
                    current: props.current,
                    onDismiss: hideModal,
                    onChange: (ds, defaultQueries) => {
                        onChange(ds, defaultQueries);
                        hideModal();
                    },
                });
                reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_ADVANCED_DS_PICKER });
            }, ref: props.footerRef, onKeyDown: isUploadFileEnabled ? onKeyDownFirstButton : onKeyDownLastButton },
            React.createElement(Trans, { i18nKey: "data-source-picker.open-advanced-button" }, "Open advanced data source picker"),
            React.createElement(Icon, { name: "arrow-right" })))),
        isUploadFileEnabled && (React.createElement(Button, { variant: "secondary", size: "sm", onClick: onClickAddCSV, onKeyDown: onKeyDownLastButton }, "Add csv or spreadsheet"))));
}
function getStylesFooter(theme) {
    return {
        footer: css `
      flex: 0;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      padding: ${theme.spacing(1.5)};
      border-top: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
    `,
    };
}
//# sourceMappingURL=DataSourceDropdown.js.map