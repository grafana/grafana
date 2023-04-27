import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, AutoSizeInput, useStyles2, Icon } from '@grafana/ui';

interface Props {
  title: string;
  onNameChange: (name: string) => void;
}

export function EditDataSourceTitle({ title, onNameChange }: Props) {
  const [isNameEditable, setIsNameEditable] = useState(false);
  const [name, setName] = useState<string>(title);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (isNameEditable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isNameEditable, inputRef]);

  useEffect(() => {
    setName(title);
  }, [title]);

  return (
    <div className={styles.container}>
      {!isNameEditable ? (
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>{name}</h1>
          <IconButton name="pen" onClick={toggleEditMode} size="lg" className={styles.editIcon} />
        </div>
      ) : (
        <div className={styles.datasourceNameInput}>
          <AutoSizeInput
            id="basic-settings-name"
            type="text"
            defaultValue={name}
            placeholder="Name"
            onCommitChange={handleChange}
            suffix={<Icon name="check" />}
            minWidth={40}
            maxWidth={80}
            required
            data-testid={selectors.pages.DataSource.name}
            ref={inputRef}
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
        fontSize: '28px',
        padding: '6px 8px',
        height: '40px',
      },
    }),
    editIcon: css({
      marginLeft: theme.spacing(1),
    }),
  };
};
