import { css } from '@emotion/css';
import { once } from 'lodash';
import React, { useState } from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  Modal,
  FileDropzone,
  FileDropzoneDefaultChildren,
  CustomScrollbar,
  useStyles2,
  Input,
  Icon,
} from '@grafana/ui';
import * as DFImport from 'app/features/dataframe-import';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { getFileDropToQueryHandler } from 'app/plugins/datasource/grafana/utils';

import { useDatasource } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { BuiltInDataSourceList } from './BuiltInDataSourceList';
import { DataSourceList } from './DataSourceList';
import { matchDataSourceWithSearch } from './utils';

const INTERACTION_EVENT_NAME = 'dashboards_dspickermodal_clicked';
const INTERACTION_ITEM = {
  SELECT_DS: 'select_ds',
  UPLOAD_FILE: 'upload_file',
  CONFIG_NEW_DS: 'config_new_ds',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
  SEARCH: 'search',
  DISMISS: 'dismiss',
};

interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  reportedInteractionFrom?: string;

  // DS filters
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  logs?: boolean;
}

export function DataSourceModal({
  dashboard,
  mixed,
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';

  const onDismissModal = () => {
    onDismiss();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
  };
  const onChangeDataSource = (ds: DataSourceInstanceSettings) => {
    onChange(ds);
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_DS,
      ds_type: ds.type,
      src: analyticsInteractionSrc,
    });
  };
  // Memoizing to keep once() cached so it avoids reporting multiple times
  const reportSearchUsageOnce = React.useMemo(
    () =>
      once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
      }),
    [analyticsInteractionSrc]
  );

  const grafanaDS = useDatasource('-- Grafana --');

  const onFileDrop = getFileDropToQueryHandler((query, fileRejections) => {
    if (!grafanaDS) {
      return;
    }
    onChange(grafanaDS, [query]);

    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.UPLOAD_FILE,
      src: analyticsInteractionSrc,
    });

    if (fileRejections.length < 1) {
      onDismiss();
    }
  });

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissModal}
      onDismiss={onDismissModal}
    >
      <div className={styles.leftColumn}>
        <Input
          type="search"
          autoFocus
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
            filter={(ds) => matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn}
            onChange={onChangeDataSource}
            current={current}
            onClickEmptyStateCTA={() =>
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                src: analyticsInteractionSrc,
              })
            }
          />
          <BuiltInDataSourceList
            dashboard={dashboard}
            mixed={mixed}
            className={styles.appendBuiltInDataSourcesList}
            onChange={onChangeDataSource}
            current={current}
          />
        </CustomScrollbar>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <CustomScrollbar className={styles.builtInDataSourcesList}>
            <BuiltInDataSourceList
              onChange={onChangeDataSource}
              current={current}
              dashboard={dashboard}
              mixed={mixed}
            />
          </CustomScrollbar>
          {config.featureToggles.editPanelCSVDragAndDrop && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
                onDrop: onFileDrop,
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.newDSSection}>
          <span className={styles.newDSDescription}>Open a new tab and configure a data source</span>
          <AddNewDataSourceButton
            variant="secondary"
            onClick={() => {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS,
                src: analyticsInteractionSrc,
              });
              onDismiss();
            }}
          />
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

      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
    modalContent: css`
      display: flex;
      flex-direction: row;
      height: 100%;

      ${theme.breakpoints.down('md')} {
        flex-direction: column;
      }
    `,
    leftColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      padding-right: ${theme.spacing(4)};
      border-right: 1px solid ${theme.colors.border.weak};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        border-right: 0;
        padding-right: 0;
        flex: 1;
        overflow-y: auto;
      }
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(4)};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        padding-left: 0;
        flex: 0;
      }
    `,
    builtInDataSources: css`
      flex: 1 1;
      margin-bottom: ${theme.spacing(4)};

      ${theme.breakpoints.down('md')} {
        flex: 0;
      }
    `,
    builtInDataSourcesList: css`
      ${theme.breakpoints.down('md')} {
        display: none;
        margin-bottom: 0;
      }

      margin-bottom: ${theme.spacing(4)};
    `,
    appendBuiltInDataSourcesList: css`
      ${theme.breakpoints.up('md')} {
        display: none;
      }
    `,
    newDSSection: css`
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
      align-items: center;
    `,
    newDSDescription: css`
      flex: 1 0;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      color: ${theme.colors.text.secondary};
    `,
    searchInput: css`
      width: 100%;
      min-height: 32px;
      margin-bottom: ${theme.spacing(1)};
    `,
  };
}
