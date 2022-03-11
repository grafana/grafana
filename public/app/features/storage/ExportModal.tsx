import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Checkbox, Field, Input, Modal, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RootStorageMeta } from './types';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onCallback?: (selected?: string[]) => void;
  dashboards?: RootStorageMeta[];
  resources?: RootStorageMeta[];
}
export function ExportModal({ isOpen, onDismiss, onCallback, dashboards, resources }: Props) {
  const indeterminateCheckbox = useRef<HTMLInputElement>(null);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!dashboards || !resources || !indeterminateCheckbox.current) {
      return;
    }
    const allItemsLength = [...dashboards, ...resources].length;
    // Everyting is selected show a check mark
    if (selectedCheckboxes.length === allItemsLength) {
      indeterminateCheckbox.current.indeterminate = false;
      indeterminateCheckbox.current.checked = true;
      // Nothing is selected show nothing
    } else if (selectedCheckboxes.length === 0) {
      indeterminateCheckbox.current.indeterminate = false;
      indeterminateCheckbox.current.checked = false;
    } else {
      indeterminateCheckbox.current.indeterminate = true;
      indeterminateCheckbox.current.checked = false;
    }
  }, [dashboards, resources, selectedCheckboxes]);

  const doExport = useCallback(() => {
    getBackendSrv()
      .post('api/storage/export')
      .then((v) => {
        alert(JSON.stringify(v));
      });
  }, []);

  const handleCheckboxChange = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedClone = [...selectedCheckboxes];
    const findIdx = selectedClone.indexOf(id);

    if (findIdx > -1) {
      selectedClone.splice(findIdx, 1);
    } else {
      selectedClone.push(id);
    }
    setSelectedCheckboxes(selectedClone);
  };

  return (
    <Modal title="Export items" isOpen={isOpen} onDismiss={onDismiss}>
      <div className={styles.modalBody}>
        <div className={styles.leftSide}>
          <Checkbox
            label="Select all"
            ref={indeterminateCheckbox}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                const allItems = [...dashboards!, ...resources!];
                setSelectedCheckboxes(allItems.map(({ config }) => config.prefix));
              } else {
                setSelectedCheckboxes([]);
              }
            }}
          />

          <ul>
            {dashboards?.map((dashboard) => renderLi(dashboard))}
            {resources?.map((resource) => renderLi(resource))}
          </ul>
        </div>
        <div />
        <div className={styles.rightSide}>
          <Field label="Destination URL">
            <Input placeholder="Git URL" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
          </Field>
        </div>
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>

        <Button
          variant="primary"
          onClick={() => {
            doExport();
            onDismiss();
          }}
        >
          Export
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );

  function renderLi(storage: RootStorageMeta): JSX.Element {
    return (
      <li key={storage.config.prefix}>
        <Checkbox
          label={storage.config.prefix}
          id={storage.config.prefix}
          onChange={handleCheckboxChange(storage.config.prefix)}
          checked={selectedCheckboxes.includes(storage.config.prefix)}
        />
      </li>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  modalBody: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
  leftSide: css`
    display: flex;
    flex-direction: column;

    ul {
      padding-left: ${theme.spacing(1)};
      list-style: none;
    }
  `,
  rightSide: css`
    display: flex;
    flex-direction: column;
    width: 50%;
  `,
});
