import { css } from '@emotion/css';
import React, { useState } from 'react';
import { DropEvent, FileRejection, DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  Modal,
  FileDropzone,
  FileDropzoneDefaultChildren,
  CustomScrollbar,
  LinkButton,
  useStyles2,
  Input,
  Icon,
} from '@grafana/ui';
import * as DFImport from 'app/features/dataframe-import';

import { DataSourceList } from './DataSourceList';

interface DataSourceModalProps {
  onFileDrop?: (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => void;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  datasources: DataSourceInstanceSettings[];
  recentlyUsed?: string[];
  enableFileUpload?: boolean;
  fileUploadOptions?: DropzoneOptions;
}

export function DataSourceModal({
  enableFileUpload,
  fileUploadOptions,
  onChange,
  onFileDrop,
  current,
  onDismiss,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      onClickBackdrop={onDismiss}
      onDismiss={onDismiss}
    >
      <div className={styles.modalContent}>
        <div className={styles.leftColumn}>
          <Input
            className={styles.searchInput}
            value={search}
            prefix={<Icon name="search" />}
            placeholder="Search data source"
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <CustomScrollbar className={styles.scrolledList}>
            <DataSourceList
              filter={(ds) => !ds.meta.builtIn && ds.name.includes(search)}
              onChange={onChange}
              current={current}
            />
          </CustomScrollbar>
        </div>
        <div className={styles.rightColumn}>
          <DataSourceList filter={(ds) => !!ds.meta.builtIn} onChange={onChange} current={current} />
          {enableFileUpload && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
                ...fileUploadOptions,
                onDrop: (...args) => {
                  onFileDrop?.(...args);
                  onDismiss();
                },
              }}
            >
              <FileDropzoneDefaultChildren primaryText={'Upload file'} />
            </FileDropzone>
          )}
          <div className={styles.dsCTAs}>
            <Button variant="secondary" fill="text" onClick={() => {}}>
              Can&apos;t find your data?
            </Button>
            <LinkButton variant="secondary" href={`datasources/new`}>
              Configure a new data source
            </LinkButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function getDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css`
      width: 80%;
    `,
    modalContent: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      overflow: hidden;
      height: 100%;
    `,
    leftColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      padding: ${theme.spacing(1)};
      height: 100%;
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      padding: ${theme.spacing(1)};
    `,
    dsCTAs: css`
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
    `,
    searchInput: css`
      width: 100%;
      margin-bottom: ${theme.spacing(1)};
    `,
    scrolledList: css`
      overflow: scroll;
    `,
  };
}
