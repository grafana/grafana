import React from 'react';
import { Checkbox, Button, Tag } from '@grafana/ui';
import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';

type VersionsTableProps = {
  versions: DecoratedRevisionModel[];
  onCheck: (ev: React.FormEvent<HTMLInputElement>, versionId: number) => void;
};
export const VersionHistoryTable: React.FC<VersionsTableProps> = ({ versions, onCheck }) => (
  <table className="filter-table gf-form-group">
    <thead>
      <tr>
        <th className="width-4"></th>
        <th className="width-4">Version</th>
        <th className="width-14">Date</th>
        <th className="width-10">Updated By</th>
        <th>Notes</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {versions.map((version, idx) => (
        <tr key={version.id}>
          <td>
            <div>
              <Checkbox checked={version.checked} onChange={ev => onCheck(ev, version.id)} />
            </div>
          </td>
          <td>{version.version}</td>
          <td>{version.createdDateString}</td>
          <td>{version.createdBy}</td>
          <td>{version.message}</td>
          <td className="text-right">
            {idx === 0 ? (
              <Tag name="Latest" colorIndex={17} />
            ) : (
              <Button variant="secondary" size="sm" icon="history" onClick={() => console.log('restore')}>
                Restore
              </Button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
