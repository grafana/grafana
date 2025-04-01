import { Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface UpdateAllButtonProps {
  disabled: boolean;
  onUpdateAll: () => void;
  updatablePluginsLength: number;
}

const UpdateAllButton = ({ disabled, onUpdateAll, updatablePluginsLength }: UpdateAllButtonProps) => {
  return (
    <Button disabled={disabled} onClick={onUpdateAll}>
      {disabled ? (
        <Trans i18nKey="plugins.catalog.no-updates-available">No updates available</Trans>
      ) : (
        <Trans i18nKey="plugins.catalog.update-all.button" values={{ length: updatablePluginsLength }}>
          Update all ({{ length }})
        </Trans>
      )}
    </Button>
  );
};

export default UpdateAllButton;
