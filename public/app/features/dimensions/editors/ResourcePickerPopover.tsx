import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
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
  maxFiles?: number;
  hidePopper?: () => void;
}

interface ErrorResponse {
  message: string;
}
export const ResourcePickerPopover = (props: Props) => {
  const { value, onChange, mediaType, folderName, maxFiles, hidePopper } = props;
  const styles = useStyles2(getStyles);

  const onClose = () => {
    onChange(value);
    hidePopper?.();
  };

  const ref = useRef<HTMLElement>(null);
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
      maxFiles={maxFiles}
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
              <Trans i18nKey="dimensions.resource-picker-popover.folder">Folder</Trans>
            </button>
            <button className={getTabClassName(PickerTabType.URL)} onClick={() => setActivePicker(PickerTabType.URL)}>
              <Trans i18nKey="dimensions.resource-picker-popover.url">URL</Trans>
            </button>
          </div>
          <div className={styles.resourcePickerPopoverContent}>
            {renderPicker()}
            <div className={styles.buttonRow}>
              <Button variant={'secondary'} onClick={() => onClose()} fill="outline">
                <Trans i18nKey="dimensions.resource-picker-popover.cancel">Cancel</Trans>
              </Button>
              <Button
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
                          .then(() => onChange(`${config.appUrl}api/storage/read/${data.path}`))
                          .then(() => hidePopper?.());
                      })
                      .catch((err) => console.error(err));
                  } else {
                    onChange(newValue);
                    hidePopper?.();
                  }
                }}
              >
                <Trans i18nKey="dimensions.resource-picker-popover.select">Select</Trans>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </FocusScope>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  resourcePickerPopover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  resourcePickerPopoverTab: css({
    width: '50%',
    textAlign: 'center',
    padding: theme.spacing(1, 0),
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    border: 'none',

    '&:focus:not(:focus-visible)': {
      outline: 'none',
      boxShadow: 'none',
    },

    ':focus-visible': {
      position: 'relative',
    },
  }),
  resourcePickerPopoverActiveTab: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    background: theme.colors.background.primary,
  }),
  resourcePickerPopoverContent: css({
    width: '315px',
    fontSize: theme.typography.bodySmall.fontSize,
    minHeight: '184px',
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
  }),
  resourcePickerPopoverTabs: css({
    display: 'flex',
    width: '100%',
    borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
  }),
  buttonRow: css({
    display: 'flex',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1),
  }),
});
