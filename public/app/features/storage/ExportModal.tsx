import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Checkbox, Field, Input, Modal, useStyles2, Spinner } from '@grafana/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onCallback?: (selected?: string[]) => void;
}
const exportable = [
  { label: 'Dashboards', value: 'dashboards' },
  { label: 'Data sources (coming soon)', value: 'datasources' },
  { label: 'Alerts (coming soon)', value: 'alerts' },
  { label: 'Users (coming soon)', value: 'users' },
  { label: 'Teams (coming soon)', value: 'teams' },
];

export function ExportModal({ isOpen, onDismiss, onCallback }: Props) {
  const indeterminateCheckbox = useRef<HTMLInputElement>(null);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>(exportable.map((v) => v.value));
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!indeterminateCheckbox.current) {
      return;
    }
    const allItemsLength = exportable.length;
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
  }, [selectedCheckboxes]);

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
            defaultChecked={true}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                setSelectedCheckboxes(exportable.map((v) => v.value));
              } else {
                setSelectedCheckboxes([]);
              }
            }}
          />

          <ul>
            {exportable.map((v) => (
              <li key={v.value}>
                <Checkbox
                  label={v.label}
                  id={v.value}
                  onChange={handleCheckboxChange(v.value)}
                  checked={selectedCheckboxes.includes(v.value) && v.value === 'dashboards'}
                  disabled={v.value !== 'dashboards'}
                />
              </li>
            ))}
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
            setRunning(true);
            doExport();
            //            onDismiss();
          }}
        >
          {running && <Spinner />}
          {!running && `Export`}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
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
