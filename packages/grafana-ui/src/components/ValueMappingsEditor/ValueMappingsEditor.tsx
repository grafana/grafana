import React, { useCallback, useState } from 'react';
import { GrafanaTheme2, ValueMapping } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { css } from '@emotion/css';
import { ValueMappingsEditorModal } from './ValueMappingsEditorModal';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

export function ValueMappingsEditor({ value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const onCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, [setIsEditorOpen]);

  return (
    <>
      <Button variant="secondary" size="sm" fullWidth onClick={() => setIsEditorOpen(true)} icon="pen">
        Edit
      </Button>
      <Modal isOpen={isEditorOpen} title="Value mappings" onDismiss={onCloseEditor} className={styles.modal}>
        <ValueMappingsEditorModal value={value} onChange={onChange} onClose={onCloseEditor} />
      </Modal>
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '980px',
  }),
});
