import { LogRowModel } from '@grafana/data';

interface Props {
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showTime: boolean;
  displayedFields?: string[];
}

export const GhostLogRow = ({ row, showDuplicates, showLabels, showTime, displayedFields }: Props) => {
  return (
    <tr>
      {showDuplicates && <td></td>}
      <td></td>
      <td></td>
      {showTime && <td>{row.timeEpochMs}</td>}
      {showLabels && row.uniqueLabels && <td></td>}
      <td>{displayedFields && displayedFields.length > 0 ? displayedFields.join(' ') : row.entry}</td>
    </tr>
  );
};
