import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ModalsController, useStyles2 } from '@grafana/ui';

import { DataSourceModal } from '../datasources/components/picker/DataSourceModal';

import { DataSourceDisplay } from './components/DataSourceDisplay';
import { DataSourceDrawerProps } from './types';

export function DataSourceDrawer(props: DataSourceDrawerProps) {
  const { current, onChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Button
          className={styles.picker}
          onClick={() => {
            showModal(DataSourceModal, {
              datasources: props.datasources,
              recentlyUsed: props.recentlyUsed,
              enableFileUpload: props.enableFileUpload,
              fileUploadOptions: props.fileUploadOptions,
              onFileDrop: props.onFileDrop,
              current,
              onDismiss: hideModal,
              onChange: (ds) => {
                onChange(ds.uid);
                hideModal();
              },
            });
          }}
        >
          <DataSourceDisplay dataSource={current}></DataSourceDisplay>
        </Button>
      )}
    </ModalsController>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    picker: css`
      background: ${theme.colors.background.secondary};
    `,
  };
}
