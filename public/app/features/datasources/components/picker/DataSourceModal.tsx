import { css } from '@emotion/css';
import { once } from 'lodash';
import React, { useState } from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import {
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
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  enableFileUpload?: boolean;
  fileUploadOptions?: DropzoneOptions;
  reportedInteractionFrom?: string;
}

const MAP_BUILT_IN_DS_TO_EVENT_ITEM: Record<string, string> = {
  '-- Grafana --': 'use_mock_data_ds',
  '-- Mixed --': 'use_mixed_ds',
  '-- Dashboard --': 'use_dashboard_ds',
};

export function DataSourceModal({
  enableFileUpload,
  fileUploadOptions,
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';
  const reportSearchUsageOnce = once(() => {
    reportInteraction('dashboards_dspickermodal_clicked', { item: 'search', src: analyticsInteractionSrc });
  });
  const onDismissCallback = React.useCallback(() => {
    onDismiss();
    reportInteraction('dashboards_dspickermodal_clicked', { item: 'dismiss', src: analyticsInteractionSrc });
  }, [onDismiss, analyticsInteractionSrc]);
  const onChangeCallback = React.useCallback(
    (ds: DataSourceInstanceSettings) => {
      onChange(ds);
      reportInteraction('dashboards_dspickermodal_clicked', {
        item: ds.meta.builtIn ? MAP_BUILT_IN_DS_TO_EVENT_ITEM[ds.uid] : 'select_ds',
        src: analyticsInteractionSrc,
      });
    },
    [onChange, analyticsInteractionSrc]
  );
  const onDropCallback = React.useCallback(
    (...args) => {
      fileUploadOptions?.onDrop?.(...args);
      onDismiss();
      reportInteraction('dashboards_dspickermodal_clicked', { item: 'upload_file', src: analyticsInteractionSrc });
    },
    [fileUploadOptions, onDismiss, analyticsInteractionSrc]
  );
  const onClickNewDSCallback = React.useCallback(() => {
    reportInteraction('dashboards_dspickermodal_clicked', { item: 'new_ds', src: analyticsInteractionSrc });
  }, [analyticsInteractionSrc]);

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissCallback}
      onDismiss={onDismissCallback}
    >
      <div className={styles.leftColumn}>
        <Input
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder="Search data source"
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <CustomScrollbar>
          <DataSourceList
            dashboard={false}
            mixed={false}
            variables
            filter={(ds) => ds.name.includes(search) && !ds.meta.builtIn}
            onChange={onChangeCallback}
            current={current}
          />
        </CustomScrollbar>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <DataSourceList
            className={styles.builtInDataSourceList}
            filter={(ds) => !!ds.meta.builtIn}
            dashboard
            mixed
            onChange={onChangeCallback}
            current={current}
          />
          {enableFileUpload && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
                ...fileUploadOptions,
                onDrop: onDropCallback,
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.dsCTAs}>
          <LinkButton variant="secondary" href={`datasources/new`} onClick={onClickNewDSCallback}>
            Configure a new data source
          </LinkButton>
        </div>
      </div>
    </Modal>
  );
}

function getDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css`
      width: 80%;
      height: 80%;
      max-width: 1200px;
      max-height: 900px;
    `,
    modalContent: css`
      display: flex;
      flex-direction: row;
      height: 100%;
    `,
    leftColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      padding-right: ${theme.spacing(4)};
      border-right: 1px solid ${theme.colors.border.weak};
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(4)};
    `,
    builtInDataSources: css`
      flex: 1;
      margin-bottom: ${theme.spacing(4)};
    `,
    builtInDataSourceList: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    dsCTAs: css`
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: flex-end;
    `,
    searchInput: css`
      width: 100%;
      min-height: 32px;
      margin-bottom: ${theme.spacing(1)};
    `,
  };
}
