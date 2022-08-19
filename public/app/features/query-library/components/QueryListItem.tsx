import { css, cx } from '@emotion/css';
import { uniq } from 'lodash';
import React, { memo, useEffect, useState } from 'react';

import { DataSourceApi, GrafanaTheme2 } from '@grafana/data/src';
import { getDataSourceSrv } from '@grafana/runtime/src';
import { Icon, Tooltip } from '@grafana/ui';
import { Badge, IconButton, useStyles2 } from '@grafana/ui/src';

import { getSavedQuerySrv } from '../api/SavedQueriesSrv';
import { QueryItem } from '../types';

import { QueryEditorDrawer } from './QueryEditorDrawer';

type QueryListItemProps = {
  query: QueryItem;
  showModal: <T>(component: React.ComponentType<T>, props: T) => void;
  hideModal: () => void;
  updateComponent: () => void;
  author: string;
  date: string;
};

export const QueryListItem = memo(
  ({ query, showModal, hideModal, updateComponent, author, date }: QueryListItemProps) => {
    const styles = useStyles2(getStyles);
    const [dsInfo, setDsInfo] = useState<DataSourceApi[]>([]);

    const gitUidStart = '^it/';
    const regexp = new RegExp(gitUidStart);

    const hasGitIntegration = regexp.test(query.uid);

    useEffect(() => {
      const getQueryDsInstance = async () => {
        const uniqueUids = uniq(query?.ds_uid ?? []);
        setDsInfo((await Promise.all(uniqueUids.map((dsUid) => getDataSourceSrv().get(dsUid)))).filter(Boolean));
      };

      getQueryDsInstance();
    }, [query.ds_uid]);

    const closeDrawer = () => {
      hideModal();
      updateComponent();
    };

    const openDrawer = async () => {
      const result = await getSavedQuerySrv().getSavedQueryByUids([{ uid: query.uid }]);
      const savedQuery = result[0];

      showModal(QueryEditorDrawer, { onDismiss: closeDrawer, savedQuery: savedQuery });
    };

    const deleteQuery = async () => {
      await getSavedQuerySrv().deleteSavedQuery({ uid: query.uid });
      updateComponent();
    };

    const getDsType = () => {
      const dsType = dsInfo?.length > 1 ? 'mixed' : dsInfo?.[0]?.type ?? 'datasource';
      return startWithUpperCase(dsType);
    };

    const startWithUpperCase = (dsType: string) => {
      return dsType.charAt(0).toUpperCase() + dsType.slice(1);
    };

    const getTooltip = () => {
      return (
        <div>
          <ul className={styles.dsTooltipList}>
            {dsInfo.map((dsI, key) => {
              return (
                <li key={key}>
                  <img className={styles.dsTooltipIcon} src={dsI?.meta?.info.logos.small} alt="datasource image" />
                  &nbsp;
                  {startWithUpperCase(dsI.type)}
                </li>
              );
            })}
          </ul>
        </div>
      );
    };

    return (
      <tr key={query.uid} className={styles.row}>
        <td onClick={openDrawer}>
          <Icon name={'lock'} className={styles.disabled} />
        </td>
        <td onClick={openDrawer}>
          <Badge color={'green'} text={'1'} icon={'link'} />
          {hasGitIntegration && (
            <img src={'public/app/features/query-library/img/git.png'} alt="git icon" className={styles.gitIcon} />
          )}
        </td>
        <td onClick={openDrawer}>{query.title}</td>
        <td onClick={openDrawer}>
          <img
            className={styles.dsIcon}
            src={getDsType() === 'Mixed' ? 'public/img/icn-datasource.svg' : dsInfo[0]?.meta?.info.logos.small}
            alt="datasource image"
            style={{ width: '16px', height: '16px' }}
          />
          &nbsp;&nbsp;{getDsType()}&nbsp;
          {getDsType() === 'Mixed' && (
            <Tooltip content={getTooltip()}>
              <Icon name={'question-circle'} className={styles.infoIcon} />
            </Tooltip>
          )}
        </td>
        <td onClick={openDrawer}>
          <img
            className={cx('filter-table__avatar', styles.dsIcon)}
            src={'/avatar/46d229b033af06a191ff2267bca9ae56'}
            alt={`Avatar for ${author}`}
          />
          &nbsp;&nbsp;{author}
        </td>
        <td onClick={openDrawer}>{date}</td>
        <td className={styles.tableTr}>
          <IconButton name="share-alt" tooltip={'Share'} />
          <IconButton name="copy" tooltip={'Copy'} />
          <IconButton name="upload" tooltip={'Upload'} />
          <IconButton name="cog" tooltip={'Settings'} />
          <IconButton name="trash-alt" tooltip={'Delete'} onClick={deleteQuery} />
        </td>
      </tr>
    );
  }
);

QueryListItem.displayName = 'QueryListItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    row: css`
      height: 70px;
      cursor: pointer;
    `,
    tableTr: css`
      display: flex;
      justify-content: space-between;
      margin-top: 22px;
    `,
    disabled: css`
      color: ${theme.colors.text.secondary};
    `,
    gitIcon: css`
      width: 30px;
      height: 30px;
      margin-left: 10px;
      margin-top: 1px;
      opacity: 0.8;
    `,
    infoIcon: css`
      margin-top: -2px;
    `,
    dsTooltipIcon: css`
      width: 11px;
      height: 11px;
    `,
    dsIcon: css`
      width: 16px !important;
      height: 16px !important;
    `,
    dsTooltipList: css`
      list-style-type: none;
    `,
  };
};
