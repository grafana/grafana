import moment from 'moment';
import React from 'react';

import { AuditRecord } from 'app/types';

export interface Props {
  records: AuditRecord[];
}

export const AuditRecordsTable = ({ records }: Props) => {
  return (
    <>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th>Date</th>
            <th>Username</th>
            <th>IP Address</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id}>
              <td className="width-4">{moment(record.created_at, moment.ISO_8601).format('YYYY-MM-DD HH:mm:ss')}</td>
              <td>{record.username}</td>
              <td>{record.ip_address}</td>
              <td>{record.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
