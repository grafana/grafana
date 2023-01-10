import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, FileDropzone, useStyles2 } from '@grafana/ui';

import { CreateNewQuery } from './CreateNewQuery';
import { SavedQueryUpdateOpts } from './QueryEditorDrawer';

type Props = {
  options: SavedQueryUpdateOpts;
  onDismiss: () => void;
};

export const QueryImportDrawer = ({ onDismiss, options }: Props) => {
  const styles = useStyles2(getStyles);

  const [file, setFile] = useState<File | undefined>(undefined);

  return (
    <Drawer title="Import query" onClose={onDismiss} width={'1000px'} expandable scrollableContent>
      <FileDropzone
        readAs="readAsBinaryString"
        onFileRemove={() => {
          setFile(undefined);
        }}
        options={{
          accept: '.json',
          multiple: false,
          onDrop: (acceptedFiles: File[]) => {
            setFile(acceptedFiles[0]);
          },
        }}
      >
        <div>Drag and drop here or browse</div>
      </FileDropzone>

      {Boolean(file) && (
        <div className={styles.queryPreview}>
          <CreateNewQuery options={options} onDismiss={onDismiss} />
        </div>
      )}
    </Drawer>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryPreview: css`
      margin-top: 20px;
      margin-bottom: 20px;
      margin-left: 170px;
    `,
  };
};
