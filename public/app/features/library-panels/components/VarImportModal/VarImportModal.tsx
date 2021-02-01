import { Button, Modal, NewTable, useStyles } from '@grafana/ui';
import React, { FC } from 'react';
import { css } from 'emotion';

interface TemplateVar {
  name: string;
  definition: string;
}

interface Props {
  vars: TemplateVar[];
  onDismiss?: () => void;
  isOpen?: boolean;
}

export const VarImportModal: FC<Props> = ({ vars, onDismiss, isOpen }) => {
  const styles = useStyles(getStyles);

  return (
    <Modal icon="x" title="Template variables will be imported" onDismiss={onDismiss} isOpen={isOpen}>
      <p className={styles.p}>This reusable panel expects the following {vars.length} template variables:</p>
      <NewTable
        headers={[
          { name: 'Variable', sortable: false },
          { name: 'Definition', sortable: false },
        ]}
        rows={vars.map(({ name, definition }) => [name, definition])}
        tableClass={styles.table}
      />
      <p className={styles.p}>Grafana will import them into your dashboard. Do you wish to proceed?</p>
      <div className={styles.buttons}>
        <Button>Import template variables and add panel</Button>
        <Button variant="secondary" onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};

const getStyles = () => ({
  buttons: css`
    display: flex;
    gap: 10px;
  `,
  table: css`
    width: 100%;
  `,
  p: css`
    margin-top: 14px;
    margin-bottom: 14px;
  `,
});
