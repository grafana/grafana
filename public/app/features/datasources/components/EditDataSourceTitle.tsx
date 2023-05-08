import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, AutoSizeInput, useStyles2 } from '@grafana/ui';

interface Props {
  dataSource: DataSourceSettings;
  title: string;
  readOnly: boolean;
  onUpdate: (dataSource: DataSourceSettings) => Promise<DataSourceSettings>;
}

export function EditDataSourceTitle({ dataSource, title, readOnly, onUpdate }: Props) {
  const [isNameEditable, setIsNameEditable] = useState(false);
  const [name, setName] = useState<string>(title);
  const [initialDataSource, setInitialDataSource] = useState<DataSourceSettings>(dataSource);
  const styles = useStyles2(getStyles);

  const toggleEditMode = () => {
    setIsNameEditable(!isNameEditable);
  };

  const handleNameChange = async (name: string) => {
    setName(name);
    toggleEditMode();
    try {
      await onUpdate({ ...initialDataSource, name });
    } catch (err) {
      return;
    }
  };

  useEffect(() => {
    setName(title);
  }, [title]);

  // update this to read only initial dataSource load
  // currently it picks up dataSource updates from form
  useEffect(() => {
    setInitialDataSource(dataSource);
  }, [dataSource]);

  return (
    <div className={styles.container}>
      {!isNameEditable ? (
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>{name}</h1>
          {!readOnly && (
            <IconButton
              name="pen"
              onClick={toggleEditMode}
              size="lg"
              title="Change data source name"
              className={styles.editIcon}
              data-testid={selectors.pages.DataSource.nameEditIcon}
            />
          )}
        </div>
      ) : (
        <div className={styles.datasourceNameInput}>
          <AutoSizeInput
            id="edit-data-source-name"
            type="text"
            defaultValue={name}
            placeholder="Name"
            onCommitChange={(evt: React.FormEvent<HTMLInputElement>) => handleNameChange(evt.currentTarget.value)}
            minWidth={40}
            maxWidth={80}
            required
            data-testid={selectors.pages.DataSource.name}
            autoFocus={isNameEditable}
          ></AutoSizeInput>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: theme.spacing(2),
    }),
    titleContainer: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      h1: {
        display: 'inline-block',
      },
    }),
    title: css({
      margin: '0 0 0 0',
      maxWidth: '500px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    datasourceNameInput: css({
      input: {
        fontSize: theme.typography.h1.fontSize,
        padding: '6px 8px',
        height: '40px',
      },
    }),
    editIcon: css({
      marginLeft: theme.spacing(1),
    }),
  };
};
