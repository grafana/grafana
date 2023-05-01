import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, AutoSizeInput, useStyles2 } from '@grafana/ui';

interface Props {
  title: string;
  onNameChange: (name: string) => void;
}

export function EditDataSourceTitle({ title, onNameChange }: Props) {
  const [isNameEditable, setIsNameEditable] = useState(false);
  const [name, setName] = useState<string>(title);
  const styles = useStyles2(getStyles);

  const toggleEditMode = () => {
    setIsNameEditable(!isNameEditable);
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    onNameChange(event.currentTarget.value);
    setName(event.currentTarget.value);
    toggleEditMode();
  };

  useEffect(() => {
    setName(title);
  }, [title]);

  return (
    <div className={styles.container}>
      {!isNameEditable ? (
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>{name}</h1>
          <IconButton
            name="pen"
            onClick={toggleEditMode}
            size="lg"
            className={styles.editIcon}
            data-testid={selectors.pages.DataSource.nameEditIcon}
          />
        </div>
      ) : (
        <div className={styles.datasourceNameInput}>
          <AutoSizeInput
            id="basic-settings-name"
            type="text"
            defaultValue={name}
            placeholder="Name"
            onCommitChange={handleChange}
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
    }),
    title: css({
      margin: '0 0 0 0',
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
