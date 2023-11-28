/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React, { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card, Icon, useStyles2 } from '@grafana/ui';
import { Databases } from 'app/percona/shared/core';
import * as UserFlow from 'app/percona/shared/core/reducers/userFlow';
import { useDispatch } from 'app/types';
import { InstanceTypesExtra } from '../../panel.types';
import { Messages } from './AddInstance.messages';
import { getStyles } from './AddInstance.styles';
export const SelectInstance = ({ type, isSelected, icon, selectInstanceType, title }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Card, { "data-testid": `${type}-instance`, onClick: selectInstanceType(type), className: styles.InstanceCard },
        React.createElement(Card.Heading, null, title),
        React.createElement(Card.Description, null, Messages.titles.addInstance),
        React.createElement(Card.Figure, null,
            React.createElement(Icon, { size: "xxxl", name: icon ? icon : 'database' }))));
};
export const AddInstance = ({ selectedInstanceType, onSelectInstanceType, showAzure }) => {
    const styles2 = useStyles2(getStyles);
    const instanceList = useMemo(() => [
        { type: InstanceTypesExtra.rds, title: Messages.titles.rds },
        { type: Databases.mysql, title: Messages.titles.mysql, icon: 'percona-database-mysql' },
        { type: Databases.mongodb, title: Messages.titles.mongodb, icon: 'percona-database-mongodb' },
        { type: Databases.postgresql, title: Messages.titles.postgresql, icon: 'percona-database-postgresql' },
        { type: Databases.proxysql, title: Messages.titles.proxysql, icon: 'percona-database-proxysql' },
        { type: Databases.haproxy, title: Messages.titles.haproxy, icon: 'percona-database-haproxy' },
        { type: InstanceTypesExtra.external, title: Messages.titles.external },
        { type: InstanceTypesExtra.azure, title: Messages.titles.azure, isHidden: !showAzure },
    ], [showAzure]);
    const dispatch = useDispatch();
    dispatch(UserFlow.startFlow(uuidv4(), 'inventory:add_instance'));
    const selectInstanceType = (type) => () => {
        dispatch(UserFlow.emitEvent('select_instance_type', {
            type,
        }));
        /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
        onSelectInstanceType({ type: type });
    };
    return (React.createElement("section", { className: styles2.Content },
        React.createElement("h2", null, Messages.sectionTitle),
        React.createElement("p", { className: styles2.Description }, Messages.description),
        React.createElement("nav", { className: styles2.NavigationPanel }, instanceList
            .filter(({ isHidden }) => !isHidden)
            .map((item) => (React.createElement(SelectInstance, { isSelected: item.type === selectedInstanceType.type, selectInstanceType: selectInstanceType, type: item.type, icon: item.icon, title: item.title, key: item.type }))))));
};
//# sourceMappingURL=AddInstance.js.map