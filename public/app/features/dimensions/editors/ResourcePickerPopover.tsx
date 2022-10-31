import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';

import { MediaType, PickerTabType, ResourceFolderName } from '../types';

import { FileUploader } from './FileUploader';
import { FolderPickerTab } from './FolderPickerTab';
import { URLPickerTab } from './URLPickerTab';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  onChange: (value?: string) => void;
  mediaType: MediaType;
  folderName: ResourceFolderName;
}

interface ErrorResponse {
  message: string;
}
export const ResourcePickerPopover = (props: Props) => {
  const { value, onChange, mediaType, folderName } = props;
  const styles = useStyles2(getStyles);

  const onClose = () => {
    onChange(value);
  };

  const ref = createRef<HTMLElement>();
  const { dialogProps } = useDialog({}, ref);
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen: true }, ref);

  const isURL = value && value.includes('://');
  const [newValue, setNewValue] = useState<string>(value ?? '');
  const [activePicker, setActivePicker] = useState<PickerTabType>(isURL ? PickerTabType.URL : PickerTabType.Folder);
  const [formData, setFormData] = useState<FormData>(new FormData());
  const [upload, setUpload] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponse>({ message: '' });

  const getTabClassName = (tabName: PickerTabType) => {
    return `${styles.resourcePickerPopoverTab} ${activePicker === tabName && styles.resourcePickerPopoverActiveTab}`;
  };

  const renderFolderPicker = () => (
    <FolderPickerTab
      value={value}
      mediaType={mediaType}
      folderName={folderName}
      newValue={newValue}
      setNewValue={setNewValue}
    />
  );

  const renderURLPicker = () => <URLPickerTab newValue={newValue} setNewValue={setNewValue} mediaType={mediaType} />;
  const renderUploader = () => (
    <FileUploader
      mediaType={mediaType}
      setFormData={setFormData}
      setUpload={setUpload}
      newValue={newValue}
      error={error}
    />
  );
  const renderPicker = () => {
    switch (activePicker) {
      case PickerTabType.Folder:
        return renderFolderPicker();
      case PickerTabType.URL:
        return renderURLPicker();
      case PickerTabType.Upload:
        return renderUploader();
      default:
        return renderFolderPicker();
    }
  };

  return (
    <FocusScope contain autoFocus restoreFocus>
      <section ref={ref} {...overlayProps} {...dialogProps}>
        <div className={styles.resourcePickerPopover}>
          <div className={styles.resourcePickerPopoverTabs}>
            <button
              className={getTabClassName(PickerTabType.Folder)}
              onClick={() => setActivePicker(PickerTabType.Folder)}
            >
              Folder
            </button>
            <button className={getTabClassName(PickerTabType.URL)} onClick={() => setActivePicker(PickerTabType.URL)}>
              URL
            </button>
          </div>
          <div className={styles.resourcePickerPopoverContent}>
            {renderPicker()}
            <ButtonGroup className={styles.buttonGroup}>
              <Button className={styles.button} variant={'secondary'} onClick={() => onClose()}>
                Cancel
              </Button>
              <Button
                className={styles.button}
                variant={newValue && newValue !== value ? 'primary' : 'secondary'}
                onClick={() => {
                  if (upload) {
                    fetch('/api/storage/upload', {
                      method: 'POST',
                      body: formData,
                    })
                      .then((res) => {
                        if (res.status >= 400) {
                          res.json().then((data) => setError(data));
                          return;
                        } else {
                          return res.json();
                        }
                      })
                      .then((data) => {
                        getBackendSrv()
                          .get(`api/storage/read/${data.path}`)
                          .then(() => setNewValue(`${config.appUrl}api/storage/read/${data.path}`))
                          .then(() => onChange(`${config.appUrl}api/storage/read/${data.path}`));
                      })
                      .catch((err) => console.error(err));
                  } else {
                    onChange(newValue);
                  }
                }}
              >
                Select
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </section>
    </FocusScope>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  resourcePickerPopover: css`
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
  `,
  resourcePickerPopoverTab: css`
    width: 50%;
    text-align: center;
    padding: ${theme.spacing(1, 0)};
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    cursor: pointer;
    border: none;

    &:focus:not(:focus-visible) {
      outline: none;
      box-shadow: none;
    }

    :focus-visible {
      position: relative;
    }
  `,
  resourcePickerPopoverActiveTab: css`
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeightMedium};
    background: ${theme.colors.background.primary};
  `,
  resourcePickerPopoverContent: css`
    width: 315px;
    font-size: ${theme.typography.bodySmall.fontSize};
    min-height: 184px;
    padding: ${theme.spacing(1)};
    display: flex;
    flex-direction: column;
  `,
  resourcePickerPopoverTabs: css`
    display: flex;
    width: 100%;
    border-radius: ${theme.shape.borderRadius()} ${theme.shape.borderRadius()} 0 0;
  `,
  buttonGroup: css`
    align-self: center;
    flex-direction: row;
  `,
  button: css`
    margin: 12px 20px 5px;
  `,
});
