import { Button, Modal, NewTable } from '@grafana/ui';
import React, { FC } from 'react';
import { css, cx } from 'emotion';

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
  const styles = getStyles();

  return (
    <Modal icon="x" title="Template variables will be imported" onDismiss={onDismiss} isOpen={isOpen}>
      <p className={cx(styles.p)}>This reusable panel expects the following {vars.length} template variables:</p>
      <NewTable
        headers={[
          { name: 'Variable', sortable: false },
          { name: 'Definition', sortable: false },
        ]}
        rows={vars.map(({ name, definition }) => [name, definition])}
        tableClass={cx(styles.table)}
      />
      <p className={cx(styles.p)}>Grafana will import them into your dashboard. Do you wish to proceed?</p>
      <div className={cx(styles.buttons)}>
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
