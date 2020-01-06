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
    display: table-row;
    cursor: pointer;
    background: ${theme.background.panelEditorVizItem};

    &:hover {
      background: ${theme.background.panelEditorVizItemHover};
      color: ${theme.colors.textStrong};
    }
  `,
  dataSourceLogoWrapper: css`
    display: table-cell;
    text-align: center;
    vertical-align: middle;
    padding: ${theme.spacing.md};

    border-width: 2px 0 2px 2px;
    border-style: solid;
    border-color: ${theme.colors.primaryBorder};
    border-radius: 3px 0 0 3px;
  `,
  dataSourceLogoWrapperOnCardHover: css`
    border-color: ${theme.colors.primaryBorderHover};
  `,
  dataSourceLogo: css`
    min-width: 55px;
    width: 55px;
    min-height: 55px;
    max-height: 55px;
    margin-bottom: ${theme.spacing.xxs};
  `,
  dataSourceNameWrapper: css`
    display: table-cell;
    vertical-align: middle;
    border-width: 2px 0;
    border-style: solid;
    border-color: ${theme.colors.primaryBorder};
  `,
  dataSourceNameWrapperOnCardHover: css`
    border-color: ${theme.colors.primaryBorderHover};
  `,
  dataSourceName: css`
    font-size: ${theme.typography.heading.h5};
    display: block;
  `,
  dataSourceType: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
    display: block;
  `,
  dataSourceURLWrapper: css`
    border-width: 2px 0;
    border-style: solid;
    border-color: ${theme.colors.primaryBorder};
  `,
  dataSourceURLWrapperOnCardHover: css`
    border-color: ${theme.colors.primaryBorderHover};
  `,
  dataSourceURL: css`
    font-size: ${theme.typography.heading.h5};
  `,
  dataSourceActionsWrapper: css`
    text-align: center;
    min-width: 240px;
    border-width: 2px 2px 2px 0;
    border-style: solid;
    border-color: ${theme.colors.primaryBorder};
    border-radius: 0 3px 3px 0;
  `,
  dataSourceActionsWrapperOnDelete: css`
    text-align: left;
  `,
  dataSourceActionsWrapperOnCardHover: css`
    opacity: 1;
    transition: 0.15s opacity ease-in-out;
    border-color: ${theme.colors.primaryBorderHover};
  `,
  actionsLink: css`
    opacity: 0;
    height: 16px;
    margin: 0 8px;
    vertical-align: middle;

    &:before {
      font-size: 16px;
      position: relative;
    }
  `,
  actionsLinkOnCardHover: css`
    opacity: 0.6;

    &:hover {
      opacity: 1;
      transition: 0.15s opacity ease-in-out;
    }
  `,
  actionsBtn: css`
    opacity: 0;
    margin-left: ${theme.spacing.md};
    cursor: pointer;
  `,
  actionsBtnBackground: css`
    background: ${theme.colors.primary};

    &:hover {
      background: ${theme.colors.primaryHover};
    }
  `,
  actionsBtnOnCardHover: css`
    opacity: 1;
  `,
  actionsBtnOnDelete: css`
    margin-left: ${theme.spacing.sm};
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
    <tr className={style.dataSourceCard} onMouseEnter={toggleItemMouseover} onMouseLeave={toggleItemMouseover}>
      <td className={cx(style.dataSourceLogoWrapper, itemMouseover ? style.dataSourceLogoWrapperOnCardHover : '')}>
        <img className={style.dataSourceLogo} src={dataSource.typeLogoUrl} />
      </td>
      <td className={cx(style.dataSourceNameWrapper, itemMouseover ? style.dataSourceNameWrapperOnCardHover : '')}>
        <span className={style.dataSourceName}>{dataSource.name}</span>
        {dataSource.type && <span className={style.dataSourceType}>{dataSource.type}</span>}
      </td>
      <td className={cx(style.dataSourceURLWrapper, itemMouseover ? style.dataSourceURLWrapperOnCardHover : '')}>
        <span className={style.dataSourceURL}>{dataSource.url}</span>
      </td>
      <td
        className={cx(
          style.dataSourceActionsWrapper,
          itemMouseover ? style.dataSourceActionsWrapperOnCardHover : '',
          deleteConfirmOpen ? style.dataSourceActionsWrapperOnDelete : ''
        )}
      >
        {!deleteConfirmOpen ? (
          <>
            <a
              className={cx(
                style.actionsLink,
                'gicon',
                'gicon-explore',
                itemMouseover ? style.actionsLinkOnCardHover : ''
              )}
              aria-label={e2e.pages.DataSources.selectors.dataSources(dataSource.name)}
              href={`explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22${dataSource.name}%22,%7B%7D,%7B%22mode%22:%22Metrics%22%7D,%7B%22ui%22:%5Btrue,true,true,%22none%22%5D%7D%5D`}
            />
            {/* <a
              className={cx(style.actionsLink, 'gicon', 'gicon-dashboard')}
              href={`/datasources/edit/${dataSource.id}/dashboards`}
            /> */}
            <a
              className={cx(style.actionsLink, 'fa', 'fa-trash', itemMouseover ? style.actionsLinkOnCardHover : '')}
              onClick={toggleDeleteOpen}
            />
            <a
              className={cx(
                'btn',
                'btn-primary',
                style.actionsBtn,
                style.actionsBtnBackground,
                itemMouseover ? style.actionsBtnOnCardHover : ''
              )}
              href={`datasources/edit/${dataSource.id}`}
            >
              Configure
            </a>
          </>
        ) : null}
        {deleteConfirmOpen ? (
          <>
            <a
              className={cx(
                'btn',
                'btn-danger',
                style.actionsBtn,
                itemMouseover ? style.actionsBtnOnCardHover : '',
                style.actionsBtnOnDelete
              )}
              onClick={onDelete}
            >
              Confirm delete
            </a>
            <a
              className={cx('btn', style.actionsBtn, itemMouseover ? style.actionsBtnOnCardHover : '')}
              onClick={toggleDeleteOpen}
            >
              Cancel
            </a>
          </>
        ) : null}
      </td>
    </tr>
  );
};

export default DataSourcesListItem;
