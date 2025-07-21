import { css } from '@emotion/css';
import { once } from 'lodash';
import { useMemo, useState } from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  Modal,
  FileDropzone,
  FileDropzoneDefaultChildren,
  useStyles2,
  Input,
  Icon,
  ScrollContainer,
} from '@grafana/ui';
import { acceptedFiles, maxFileSize } from 'app/features/dataframe-import/constants';
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

export interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  reportedInteractionFrom?: string;

  // DS filters
  filter?: (ds: DataSourceInstanceSettings) => boolean;
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
  uploadFile?: boolean;
}

export function DataSourceModal({
  tracing,
  dashboard,
  mixed,
  metrics,
  type,
  annotations,
  variables,
  alerting,
  pluginId,
  logs,
  uploadFile,
  filter,
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
  const reportSearchUsageOnce = useMemo(
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

  // Built-in data sources used twice because of mobile layout adjustments
  // In movile the list is appended to the bottom of the DS list
  const BuiltInList = ({ className }: { className?: string }) => {
    return (
      <BuiltInDataSourceList
        className={className}
        onChange={onChangeDataSource}
        current={current}
        filter={filter}
        variables={variables}
        tracing={tracing}
        metrics={metrics}
        type={type}
        annotations={annotations}
        alerting={alerting}
        pluginId={pluginId}
        logs={logs}
        dashboard={dashboard}
        mixed={mixed}
      />
    );
  };

  return (
    <Modal
      title={t('data-source-picker.modal.title', 'Select data source')}
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
          placeholder={t('data-source-picker.modal.input-placeholder', 'Select data source')}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <ScrollContainer>
          <DataSourceList
            onChange={onChangeDataSource}
            current={current}
            onClickEmptyStateCTA={() =>
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                src: analyticsInteractionSrc,
              })
            }
            filter={(ds) => (filter ? filter?.(ds) : true) && matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn}
            variables={variables}
            tracing={tracing}
            metrics={metrics}
            type={type}
            annotations={annotations}
            alerting={alerting}
            pluginId={pluginId}
            logs={logs}
            dashboard={dashboard}
            mixed={mixed}
          />
          <BuiltInList className={styles.appendBuiltInDataSourcesList} />
        </ScrollContainer>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <div className={styles.builtInDataSourcesList}>
            <ScrollContainer>
              <BuiltInList />
            </ScrollContainer>
          </div>
          {uploadFile && config.featureToggles.editPanelCSVDragAndDrop && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: maxFileSize,
                multiple: false,
                accept: acceptedFiles,
                onDrop: onFileDrop,
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.newDSSection}>
          <span className={styles.newDSDescription}>
            <Trans i18nKey="data-source-picker.modal.configure-new-data-source">
              Open a new tab and configure a data source
            </Trans>
          </span>
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
    modal: css({
      width: '80%',
      height: '80%',
      maxWidth: '1200px',
      maxHeight: '900px',

      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'row',
      height: '100%',

      [theme.breakpoints.down('md')]: {
        flexDirection: 'column',
      },
    }),
    leftColumn: css({
      display: 'flex',
      flexDirection: 'column',
      width: '50%',
      height: '100%',
      paddingRight: theme.spacing(4),
      borderRight: `1px solid ${theme.colors.border.weak}`,

      [theme.breakpoints.down('md')]: {
        width: '100%',
        borderRight: 0,
        paddingRight: 0,
        flex: 1,
        overflowY: 'auto',
      },
    }),
    rightColumn: css({
      display: 'flex',
      flexDirection: 'column',
      width: '50%',
      height: '100%',
      justifyItems: 'space-evenly',
      alignItems: 'stretch',
      paddingLeft: theme.spacing(4),

      [theme.breakpoints.down('md')]: {
        width: '100%',
        paddingLeft: 0,
        flex: 0,
      },
    }),
    builtInDataSources: css({
      flex: '1 1',
      marginBottom: theme.spacing(4),

      [theme.breakpoints.down('md')]: {
        flex: 0,
      },
    }),
    builtInDataSourcesList: css({
      [theme.breakpoints.down('md')]: {
        display: 'none',
        marginBottom: 0,
      },

      marginBottom: theme.spacing(4),
    }),
    appendBuiltInDataSourcesList: css({
      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    }),
    newDSSection: css({
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    newDSDescription: css({
      flex: '1 0',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
    }),
    searchInput: css({
      width: '100%',
      minHeight: '32px',
      marginBottom: theme.spacing(1),
    }),
  };
}
