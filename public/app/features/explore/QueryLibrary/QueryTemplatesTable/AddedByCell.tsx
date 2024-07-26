import { useQueryLibraryListStyles } from './styles';

type AddedByCellProps = {
  user?: string;
};
export function AddedByCell(props: AddedByCellProps) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.otherText}>{props.user || 'Unknown'}</span>
    </div>
  );
}
