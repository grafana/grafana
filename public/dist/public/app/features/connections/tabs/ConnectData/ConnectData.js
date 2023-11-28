import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { PluginType } from '@grafana/data';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { useGetAll } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types';
import { ROUTES } from '../../constants';
import { CardGrid } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoAccessModal } from './NoAccessModal';
import { NoResults } from './NoResults';
import { Search } from './Search';
const getStyles = () => ({
    spacer: css `
    height: 16px;
  `,
    modal: css `
    width: 500px;
  `,
    modalContent: css `
    overflow: visible;
  `,
});
export function AddNewConnection() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isNoAccessModalOpen, setIsNoAccessModalOpen] = useState(false);
    const [focusedItem, setFocusedItem] = useState(null);
    const styles = useStyles2(getStyles);
    const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
    const handleSearchChange = (e) => {
        setSearchTerm(e.currentTarget.value.toLowerCase());
    };
    const { error, plugins, isLoading } = useGetAll({
        keyword: searchTerm,
        type: PluginType.datasource,
    });
    const cardGridItems = useMemo(() => plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
        angularDetected: plugin.angularDetected,
    })), [plugins]);
    const onClickCardGridItem = (e, item) => {
        if (!canCreateDataSources) {
            e.preventDefault();
            e.stopPropagation();
            openModal(item);
        }
    };
    const openModal = (item) => {
        setIsNoAccessModalOpen(true);
        setFocusedItem(item);
    };
    const closeModal = () => {
        setIsNoAccessModalOpen(false);
        setFocusedItem(null);
    };
    const showNoResults = useMemo(() => !isLoading && !error && plugins.length < 1, [isLoading, error, plugins]);
    const categoryHeaderLabel = t('connections.connect-data.category-header-label', 'Data sources');
    return (React.createElement(React.Fragment, null,
        focusedItem && React.createElement(NoAccessModal, { item: focusedItem, isOpen: isNoAccessModalOpen, onDismiss: closeModal }),
        React.createElement(Search, { onChange: handleSearchChange }),
        React.createElement("div", { className: styles.spacer }),
        React.createElement(CategoryHeader, { iconName: "database", label: categoryHeaderLabel }),
        isLoading ? (React.createElement(LoadingPlaceholder, { text: "Loading..." })) : !!error ? (React.createElement("p", null,
            "Error: ",
            error.message)) : (React.createElement(CardGrid, { items: cardGridItems, onClickItem: onClickCardGridItem })),
        showNoResults && React.createElement(NoResults, null)));
}
//# sourceMappingURL=ConnectData.js.map