import { Props } from './LogRow';
import { LogRowMessageDisplayedFields } from './LogRowMessageDisplayedFields';

const onOpenContext = () => {};
export const PreviewLogRow = ({ row, showDuplicates, showLabels, showTime, displayedFields, ...rest }: Props) => {
  return (
    <tr>
      {showDuplicates && <td></td>}
      <td></td>
      <td></td>
      {showTime && <td>{row.timeEpochMs}</td>}
      {showLabels && row.uniqueLabels && <td></td>}
      {displayedFields ? <LogRowMessageDisplayedFields  {...rest} row={row} detectedFields={displayedFields} mouseIsOver={false} onOpenContext={onOpenContext} preview /> : <td>row.entry</td>}
      <td></td>
    </tr>
  );
}
