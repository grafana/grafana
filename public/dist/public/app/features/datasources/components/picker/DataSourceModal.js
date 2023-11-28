import { css } from '@emotion/css';
import { once } from 'lodash';
import React, { useState } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { Modal, FileDropzone, FileDropzoneDefaultChildren, CustomScrollbar, useStyles2, Input, Icon, } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import * as DFImport from 'app/features/dataframe-import';
import { getFileDropToQueryHandler } from 'app/plugins/datasource/grafana/utils';
import { useDatasource } from '../../hooks';
import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { BuiltInDataSourceList } from './BuiltInDataSourceList';
import { DataSourceList } from './DataSourceList';
import { matchDataSourceWithSearch } from './utils';
const INTERACTION_EVENT_NAME = 'dashboards_dspickermodal_clicked';
const INTERACTION_ITEM = {
    SELECT_DS: 'select_ds',
    UPLOAD_FILE: 'upload_file',
    CONFIG_NEW_DS: 'config_new_ds',
    CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
    SEARCH: 'search',
    DISMISS: 'dismiss',
};
export function DataSourceModal({ tracing, dashboard, mixed, metrics, type, annotations, variables, alerting, pluginId, logs, uploadFile, filter, onChange, current, onDismiss, reportedInteractionFrom, }) {
    const styles = useStyles2(getDataSourceModalStyles);
    const [search, setSearch] = useState('');
    const analyticsInteractionSrc = reportedInteractionFrom || 'modal';
    const onDismissModal = () => {
        onDismiss();
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
    };
    const onChangeDataSource = (ds) => {
        onChange(ds);
        reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.SELECT_DS,
            ds_type: ds.type,
            src: analyticsInteractionSrc,
        });
    };
    // Memoizing to keep once() cached so it avoids reporting multiple times
    const reportSearchUsageOnce = React.useMemo(() => once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
    }), [analyticsInteractionSrc]);
    const grafanaDS = useDatasource('-- Grafana --');
    const onFileDrop = getFileDropToQueryHandler((query, fileRejections) => {
        if (!grafanaDS) {
            return;
        }
        onChange(grafanaDS, [query]);
        reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.UPLOAD_FILE,
            src: analyticsInteractionSrc,
        });
        if (fileRejections.length < 1) {
            onDismiss();
        }
    });
    // Built-in data sources used twice because of mobile layout adjustments
    // In movile the list is appended to the bottom of the DS list
    const BuiltInList = ({ className }) => {
        return (React.createElement(BuiltInDataSourceList, { className: className, onChange: onChangeDataSource, current: current, filter: filter, variables: variables, tracing: tracing, metrics: metrics, type: type, annotations: annotations, alerting: alerting, pluginId: pluginId, logs: logs, dashboard: dashboard, mixed: mixed }));
    };
    return (React.createElement(Modal, { title: t('data-source-picker.modal.title', 'Select data source'), closeOnEscape: true, closeOnBackdropClick: true, isOpen: true, className: styles.modal, contentClassName: styles.modalContent, onClickBackdrop: onDismissModal, onDismiss: onDismissModal },
        React.createElement("div", { className: styles.leftColumn },
            React.createElement(Input, { type: "search", autoFocus: true, className: styles.searchInput, value: search, prefix: React.createElement(Icon, { name: "search" }), placeholder: t('data-source-picker.modal.input-placeholder', 'Select data source'), onChange: (e) => {
                    setSearch(e.currentTarget.value);
                    reportSearchUsageOnce();
                } }),
            React.createElement(CustomScrollbar, null,
                React.createElement(DataSourceList, { onChange: onChangeDataSource, current: current, onClickEmptyStateCTA: () => reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                        src: analyticsInteractionSrc,
                    }), filter: (ds) => (filter ? filter === null || filter === void 0 ? void 0 : filter(ds) : true) && matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn, variables: variables, tracing: tracing, metrics: metrics, type: type, annotations: annotations, alerting: alerting, pluginId: pluginId, logs: logs, dashboard: dashboard, mixed: mixed }),
                React.createElement(BuiltInList, { className: styles.appendBuiltInDataSourcesList }))),
        React.createElement("div", { className: styles.rightColumn },
            React.createElement("div", { className: styles.builtInDataSources },
                React.createElement(CustomScrollbar, { className: styles.builtInDataSourcesList },
                    React.createElement(BuiltInList, null)),
                uploadFile && config.featureToggles.editPanelCSVDragAndDrop && (React.createElement(FileDropzone, { readAs: "readAsArrayBuffer", fileListRenderer: () => undefined, options: {
                        maxSize: DFImport.maxFileSize,
                        multiple: false,
                        accept: DFImport.acceptedFiles,
                        onDrop: onFileDrop,
                    } },
                    React.createElement(FileDropzoneDefaultChildren, null)))),
            React.createElement("div", { className: styles.newDSSection },
                React.createElement("span", { className: styles.newDSDescription },
                    React.createElement(Trans, { i18nKey: "data-source-picker.modal.configure-new-data-source" }, "Open a new tab and configure a data source")),
                React.createElement(AddNewDataSourceButton, { variant: "secondary", onClick: () => {
                        reportInteraction(INTERACTION_EVENT_NAME, {
                            item: INTERACTION_ITEM.CONFIG_NEW_DS,
                            src: analyticsInteractionSrc,
                        });
                        onDismiss();
                    } })))));
}
function getDataSourceModalStyles(theme) {
    return {
        modal: css `
      width: 80%;
      height: 80%;
      max-width: 1200px;
      max-height: 900px;

      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
        modalContent: css `
      display: flex;
      flex-direction: row;
      height: 100%;

      ${theme.breakpoints.down('md')} {
        flex-direction: column;
      }
    `,
        leftColumn: css `
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      padding-right: ${theme.spacing(4)};
      border-right: 1px solid ${theme.colors.border.weak};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        border-right: 0;
        padding-right: 0;
        flex: 1;
        overflow-y: auto;
      }
    `,
        rightColumn: css `
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(4)};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        padding-left: 0;
        flex: 0;
      }
    `,
        builtInDataSources: css `
      flex: 1 1;
      margin-bottom: ${theme.spacing(4)};

      ${theme.breakpoints.down('md')} {
        flex: 0;
      }
    `,
        builtInDataSourcesList: css `
      ${theme.breakpoints.down('md')} {
        display: none;
        margin-bottom: 0;
      }

      margin-bottom: ${theme.spacing(4)};
    `,
        appendBuiltInDataSourcesList: css `
      ${theme.breakpoints.up('md')} {
        display: none;
      }
    `,
        newDSSection: css `
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
      align-items: center;
    `,
        newDSDescription: css `
      flex: 1 0;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      color: ${theme.colors.text.secondary};
    `,
        searchInput: css `
      width: 100%;
      min-height: 32px;
      margin-bottom: ${theme.spacing(1)};
    `,
    };
}
//# sourceMappingURL=DataSourceModal.js.map