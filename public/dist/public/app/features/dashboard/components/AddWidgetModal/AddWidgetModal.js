import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { locationService } from '@grafana/runtime';
import { CustomScrollbar, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { onCreateNewWidgetPanel } from 'app/features/dashboard/utils/dashboard';
import { VizTypePickerPlugin } from 'app/features/panel/components/VizTypePicker/VizTypePickerPlugin';
import { filterPluginList, getWidgetPluginMeta } from 'app/features/panel/state/util';
import { useSelector } from 'app/types';
export const AddWidgetModal = () => {
    const styles = useStyles2(getStyles);
    const [searchQuery, setSearchQuery] = useState('');
    const dashboard = useSelector((state) => state.dashboard.getModel());
    const widgetsList = useMemo(() => {
        return getWidgetPluginMeta();
    }, []);
    const filteredWidgetsTypes = useMemo(() => {
        return filterPluginList(widgetsList, searchQuery);
    }, [widgetsList, searchQuery]);
    const onDismiss = () => {
        locationService.partial({ addWidget: null });
    };
    return (React.createElement(Modal, { title: "Select widget type", closeOnEscape: true, closeOnBackdropClick: true, isOpen: true, className: styles.modal, onClickBackdrop: onDismiss, onDismiss: onDismiss },
        React.createElement(Input, { type: "search", autoFocus: true, className: styles.searchInput, value: searchQuery, prefix: React.createElement(Icon, { name: "search" }), placeholder: "Search widget", onChange: (e) => {
                setSearchQuery(e.currentTarget.value);
            } }),
        React.createElement(CustomScrollbar, null,
            React.createElement("div", { className: styles.grid }, filteredWidgetsTypes.map((plugin, index) => (React.createElement(VizTypePickerPlugin, { disabled: false, key: plugin.id, isCurrent: false, plugin: plugin, onClick: (e) => {
                    const id = onCreateNewWidgetPanel(dashboard, plugin.id);
                    locationService.partial({ editPanel: id, addWidget: null });
                } })))))));
};
const getStyles = (theme) => ({
    modal: css `
    width: 65%;
    max-width: 960px;

    ${theme.breakpoints.down('md')} {
      width: 100%;
    }
  `,
    searchInput: css `
    margin-bottom: ${theme.spacing(2)};
  `,
    grid: css `
    display: grid;
    grid-gap: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=AddWidgetModal.js.map