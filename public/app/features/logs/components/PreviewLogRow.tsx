import { Props } from './LogRow';
import { LogRowMessageDisplayedFields } from './LogRowMessageDisplayedFields';

const emptyFn = () => {};
export const PreviewLogRow = ({ row, showDuplicates, showLabels, showTime, displayedFields, ...rest }: Props) => {
  return (
    <tr>
      {showDuplicates && <td></td>}
      <td></td>
      <td></td>
      {showTime && <td>{row.timeEpochMs}</td>}
      {showLabels && row.uniqueLabels && <td></td>}
      {displayedFields && displayedFields.length > 0 ? (
        <LogRowMessageDisplayedFields
          {...rest}
          row={row}
          detectedFields={displayedFields}
          mouseIsOver={false}
          onBlur={emptyFn}
          onOpenContext={emptyFn}
          preview
        />
      ) : (
        <td>{row.entry}</td>
      )}
      <td></td>
    </tr>
  );
};
