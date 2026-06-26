import { ToolbarButton } from '../ToolbarButton';
import { Tooltip } from '../Tooltip';

interface TimeSyncButtonProps {
  isSynced: boolean;
  onClick: () => void;
}

export function TimeSyncButton(props: TimeSyncButtonProps) {
  const { onClick, isSynced } = props;

  const syncTimesTooltip = () => {
    const tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
    return <>{tooltip}</>;
  };

  return (
    <Tooltip content={syncTimesTooltip} placement="bottom">
      <ToolbarButton
        icon="link"
        variant={isSynced ? 'active' : 'canvas'}
        aria-label={isSynced ? 'Un sync times' : 'Sync times'}
        onClick={onClick}
      />
    </Tooltip>
  );
}
