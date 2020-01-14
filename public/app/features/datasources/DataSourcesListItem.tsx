import React, { FunctionComponent, useContext } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { e2e } from '@grafana/e2e';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types/';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext, ResourceCard, LinkButton } from '@grafana/ui';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  actionsLink: css`
    opacity: 0.6;
    height: 20px;
    width: 20px;
    margin: 0 8px;
    vertical-align: middle;

    &:before {
      font-size: 20px;
      position: relative;
    }

    &:hover {
      opacity: 1;
      transition: 0.15s opacity ease-in-out;
    }
  `,
  rightMargin: css`
    margin-right: ${theme.spacing.md};
  `,
}));

export interface Props {
  dataSource: DataSourceSettings;
  deleteDataSource: (id: number) => void;
}

const DataSourcesListItem: FunctionComponent<Props> = ({ dataSource, deleteDataSource }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

  function onDelete() {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Are you sure you want to delete this data source?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        confirmDelete(dataSource.id);
      },
    });
  }

  function confirmDelete(id: number) {
    deleteDataSource(id);
  }

  return (
    <ResourceCard
      resourceName={dataSource.name}
      imageUrl={dataSource.typeLogoUrl}
      url={dataSource.url}
      type={dataSource.type}
      isDefault={dataSource.isDefault}
      actions={
        <>
          <a
            className={cx(style.actionsLink, 'gicon', 'gicon-explore')}
            aria-label={e2e.pages.DataSources.selectors.dataSources(dataSource.name)}
            href={`explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22${dataSource.name}%22,%7B%7D,%7B%22mode%22:%22Metrics%22%7D,%7B%22ui%22:%5Btrue,true,true,%22none%22%5D%7D%5D`}
          />
          {/* <a
            className={cx(style.actionsLink, 'gicon', 'gicon-dashboard')}
            href={`/datasources/edit/${dataSource.id}/dashboards`}
          /> */}
          <a className={cx(style.actionsLink, 'fa', 'fa-trash', style.rightMargin)} onClick={onDelete} />
          <LinkButton variant={'secondary'} href={`datasources/edit/${dataSource.id}`}>
            Configure
          </LinkButton>
        </>
      }
    />
  );
};

export default DataSourcesListItem;
