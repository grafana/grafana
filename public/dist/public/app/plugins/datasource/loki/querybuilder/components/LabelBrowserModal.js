import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, Modal, useStyles2 } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { LokiLabelBrowser } from '../../components/LokiLabelBrowser';
export const LabelBrowserModal = (props) => {
    const { isOpen, onClose, datasource, app } = props;
    const [labelsLoaded, setLabelsLoaded] = useState(false);
    const [hasLogLabels, setHasLogLabels] = useState(false);
    const LAST_USED_LABELS_KEY = 'grafana.datasources.loki.browser.labels';
    const styles = useStyles2(getStyles);
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        datasource.languageProvider.fetchLabels().then((labels) => {
            setLabelsLoaded(true);
            setHasLogLabels(labels.length > 0);
        });
    }, [datasource, isOpen]);
    const changeQuery = (value) => {
        const { query, onChange, onRunQuery } = props;
        const nextQuery = Object.assign(Object.assign({}, query), { expr: value });
        onChange(nextQuery);
        onRunQuery();
    };
    const onChange = (selector) => {
        changeQuery(selector);
        onClose();
    };
    const reportInteractionAndClose = () => {
        reportInteraction('grafana_loki_label_browser_closed', {
            app,
            closeType: 'modalClose',
        });
        onClose();
    };
    return (React.createElement(Modal, { isOpen: isOpen, title: "Label browser", onDismiss: reportInteractionAndClose, className: styles.modal },
        !labelsLoaded && React.createElement(LoadingPlaceholder, { text: "Loading labels..." }),
        labelsLoaded && !hasLogLabels && React.createElement("p", null, "No labels found."),
        labelsLoaded && hasLogLabels && (React.createElement(LocalStorageValueProvider, { storageKey: LAST_USED_LABELS_KEY, defaultValue: [] }, (lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
            return (React.createElement(LokiLabelBrowser, { languageProvider: datasource.languageProvider, onChange: onChange, lastUsedLabels: lastUsedLabels, storeLastUsedLabels: onLastUsedLabelsSave, deleteLastUsedLabels: onLastUsedLabelsDelete, app: app }));
        }))));
};
const getStyles = (theme) => {
    return {
        modal: css `
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
    };
};
//# sourceMappingURL=LabelBrowserModal.js.map