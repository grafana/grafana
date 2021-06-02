import React, { FC, Fragment } from 'react';
import { ActiveCheck } from 'app/percona/check/types';
import { Failed } from '../Failed/Failed';
import { TableDataAlertDetails } from './TableDataAlertDetails';

interface TableBodyProps {
  data: ActiveCheck[];
}

export const TableBody: FC<TableBodyProps> = ({ data }) => (
  <tbody>
    {data.map((row) => {
      const { key, name, failed, details } = row;

      return (
        <Fragment key={key}>
          <tr>
            <td rowSpan={details.length}>{name}</td>
            <td rowSpan={details.length}>
              <Failed failed={failed} />
            </td>
            <TableDataAlertDetails detailsItem={details[0]} />
          </tr>
          {details.slice(1).map((detailsItem, i) => (
            <tr key={`${key}-${i}`}>
              <TableDataAlertDetails detailsItem={detailsItem} />
            </tr>
          ))}
        </Fragment>
      );
    })}
  </tbody>
);
