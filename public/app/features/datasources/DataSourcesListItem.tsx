import React, { FunctionComponent, useState, useContext } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { e2e } from '@grafana/e2e';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types/';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext } from '@grafana/ui';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  dataSourceCard: css`
    padding: ${theme.spacing.md};
    display: flex;
    align-items: center;
    cursor: pointer;
    box-shadow: ${theme.shadow.card};
    background: ${theme.background.panelEditorVizItem};
    border: 1px solid transparent;
    border-radius: 3px;
    margin-bottom: ${theme.spacing.xxs};

    &:hover {
      box-shadow: ${theme.shadow.panelEditorVizItemHover};
      background: ${theme.background.panelEditorVizItemHover};
      border: 1px solid ${theme.colors.blueLight};
      color: ${theme.colors.textStrong};
    }
  `,
  cardActions: css`
    opacity: 0;
    padding-left: ${theme.spacing.md};
    display: flex;
    align-items: center;
    min-width: 240px;
    justify-content: flex-end;
  `,
  cardActionsBtn: css`
    margin-left: ${theme.spacing.md};
    cursor: pointer;
  `,
  cardActionsOnCardHover: css`
    opacity: 1;
    transition: 0.15s opacity ease-in-out;
  `,
  cardItemLinkOnCardHover: css`
    opacity: 0.6;
    &:hover {
      opacity: 1;
      transition: 0.15s opacity ease-in-out;
    }
  `,
  cardLogo: css`
    margin-right: ${theme.spacing.lg};
    margin-left: ${theme.spacing.sm};
    width: 55px;
    min-width: 55px;
    min-height: 55px;
    max-height: 55px;
    flex-basis: 10%;
  `,
  cardTextWrapper: css`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-basis: 30%;
  `,
  cardDescription: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
  `,
  cardText: css`
    font-size: ${theme.typography.heading.h5};
  `,
  cardUrl: css`
    padding: 0 ${theme.spacing.sm};
    flex-basis: 30%;
    display: flex;
    flex-grow: 1;
  `,
  cardLink: css`
    opacity: 0;
    height: 16px;
    margin: 0 8px;

    &:before {
      font-size: 16px;
      position: relative;
    }
  `,
}));

export interface Props {
  dataSource: DataSourceSettings;
  deleteDataSource: (id: number) => void;
}

const DataSourcesListItem: FunctionComponent<Props> = ({ dataSource, deleteDataSource }) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemMouseover, setItemMouseover] = useState(false);
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

  function toggleDeleteOpen() {
    setDeleteConfirmOpen(!deleteConfirmOpen);
  }

  function toggleItemMouseover() {
    if (!deleteConfirmOpen) {
      setItemMouseover(!itemMouseover);
    }
  }

  function onDelete() {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Are you sure you want to delete this data source?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        deleteDataSource(dataSource.id);
      },
    });
  }

  return (
    <div className={style.dataSourceCard} onMouseEnter={toggleItemMouseover} onMouseLeave={toggleItemMouseover}>
      <img className={style.cardLogo} src={dataSource.typeLogoUrl} />
      <div className={style.cardTextWrapper}>
        <span className={style.cardText}>{dataSource.name}</span>
        {dataSource.type && <span className={style.cardDescription}>{dataSource.type}</span>}
      </div>
      <div className={style.cardUrl}>
        <span className={style.cardText}>{dataSource.url}</span>
      </div>
      <div className={cx(style.cardActions, itemMouseover ? style.cardActionsOnCardHover : '')}>
        {!deleteConfirmOpen ? (
          <>
            <a
              className={cx(
                style.cardLink,
                'gicon',
                'gicon-explore',
                itemMouseover ? style.cardItemLinkOnCardHover : ''
              )}
              aria-label={e2e.pages.DataSources.selectors.dataSources(dataSource.name)}
              href={`explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22${dataSource.name}%22,%7B%7D,%7B%22mode%22:%22Metrics%22%7D,%7B%22ui%22:%5Btrue,true,true,%22none%22%5D%7D%5D`}
            />
            {/* <a
              className={cx(style.cardLink, 'gicon', 'gicon-dashboard')}
              href={`/datasources/edit/${dataSource.id}/dashboards`}
            /> */}
            <a
              className={cx(style.cardLink, 'fa', 'fa-trash', itemMouseover ? style.cardItemLinkOnCardHover : '')}
              onClick={toggleDeleteOpen}
            />
            <a className={cx('btn', 'btn-primary', style.cardActionsBtn)} href={`datasources/edit/${dataSource.id}`}>
              Configure
            </a>
          </>
        ) : null}
        {deleteConfirmOpen ? (
          <>
            <a className={cx('btn', 'btn-danger', style.cardActionsBtn)} onClick={onDelete}>
              Confirm delete
            </a>
            <a className={cx('btn', style.cardActionsBtn)} onClick={toggleDeleteOpen}>
              Cancel
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default DataSourcesListItem;
