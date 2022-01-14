import React, { FC } from 'react';
import { SEVERITY } from 'app/percona/check/CheckPanel.constants';
import { SilenceAlertButton } from 'app/percona/check/components';
import { Severity, TableDataAlertDetailsProps } from 'app/percona/check/types';
import { useStyles } from '@grafana/ui';
import { Messages } from '../../CheckPanel.messages';
import { getStyles } from './Table.styles';

export const TableDataAlertDetails: FC<TableDataAlertDetailsProps> = ({ detailsItem }) => {
  const styles = useStyles(getStyles);

  return (
    <>
      <td>{SEVERITY[detailsItem.labels.severity as Severity]}</td>
      <td>
        {detailsItem.description}
        {detailsItem.readMoreUrl ? (
          <span>
            {' '}
            -{' '}
            <a target="_blank" rel="noreferrer" className={styles.link} href={detailsItem.readMoreUrl}>
              {Messages.readMore}
            </a>
          </span>
        ) : null}
      </td>
      <td>
        {detailsItem.silenced ? (
          <div className={styles.silenced}>{Messages.silenced}</div>
        ) : (
          <SilenceAlertButton labels={detailsItem.labels} />
        )}
      </td>
    </>
  );
};
