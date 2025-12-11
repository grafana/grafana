import { t, Trans } from '@grafana/i18n';
import { Modal, Button } from '@grafana/ui';

import { layoutRegistry } from '../layouts-shared/layoutRegistry';

interface ConvertMixedGridsModalProps {
  availableIds: Set<string>;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}

export function ConvertMixedGridsModal({ availableIds, onSelect, onDismiss }: ConvertMixedGridsModalProps) {
  const options = layoutRegistry.list(Array.from(availableIds));

  return (
    <Modal
      isOpen={true}
      title={t('dashboard.rows-layout.ungroup-convert-title', 'Convert mixed grids?')}
      onDismiss={onDismiss}
    >
      <p>
        <Trans i18nKey="dashboard.rows-layout.ungroup-convert-text">
          All grids must be converted to the same type and positions will be lost.
        </Trans>
      </p>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard.rows-layout.cancel">Cancel</Trans>
        </Button>
        {options.map((opt) => (
          <Button
            icon={opt.icon}
            key={opt.id}
            variant="primary"
            onClick={() => {
              onSelect(opt.id);
              onDismiss();
            }}
          >
            <Trans i18nKey="dashboard.rows-layout.convert-to" values={{ name: opt.name }}>
              Convert to {'{{name}}'}
            </Trans>
          </Button>
        ))}
      </Modal.ButtonRow>
    </Modal>
  );
}
