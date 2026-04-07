import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, IconButton, Input, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { useDataSourceRights } from '../state/hooks';
import { setDataSourceName } from '../state/reducers';

interface EditableProps {
  title: string;
  uid: string;
}

function DataSourceEditable({ title, uid }: EditableProps) {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const rights = useDataSourceRights(uid);
  const dispatch = useDispatch();

  const onEdit = () => {
    setValue(title);
    setError(false);
    setEditing(true);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.value);
    setError(false);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (saving) {
      return;
    }
    setSaving(true);

    try {
      // Make manual API calls to avoid pre-emptively saving other changes from the EditDataSource form
      const ds = await api.getDataSourceByUid(uid);
      await api.updateDataSource({ ...ds, name: value });
      dispatch(setDataSourceName(value));
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (saving) {
      return;
    }

    setEditing(false);
  };

  const editable = rights.hasWriteRights && !rights.readOnly;
  if (!editable || !editing) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{title}</h1>
        {editable && (
          <IconButton
            name="pen"
            size="lg"
            variant="secondary"
            tooltip={t('datasources.editable-title.tooltip-edit-button', 'Edit')}
            onClick={onEdit}
          />
        )}
      </div>
    );
  }

  return (
    <form className={styles.container} onSubmit={onSubmit}>
      <Field
        className={styles.input}
        label={
          <label htmlFor="datasource-editable-title" className="sr-only">
            <Trans i18nKey="datasources.editable-title.input-label">Data source name</Trans>
          </label>
        }
        loading={saving}
        disabled={saving}
        invalid={error}
        error={error && t('datasources.editable-title.error-saving', 'Error saving data source name')}
        noMargin
      >
        <Input
          id="datasource-editable-title"
          type="text"
          value={value}
          onChange={onChange}
          placeholder={t('datasources.editable-title.input-placeholder', 'Name')}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- Once the user has toggled editing on, the input should autofocus to allow immediate editing
          autoFocus
          autoComplete="off"
        />
      </Field>
      <div className={styles.buttons}>
        <IconButton
          name="check"
          size="lg"
          variant="secondary"
          tooltip={t('datasources.editable-title.tooltip-save-button', 'Save')}
          type="submit"
          disabled={saving}
        />
        <IconButton
          name="times"
          size="lg"
          variant="secondary"
          tooltip={t('datasources.editable-title.tooltip-cancel-button', 'Cancel')}
          onClick={onCancel}
          disabled={saving}
        />
      </div>
    </form>
  );
}

interface Props {
  title: string;
  /** Enables title editing (if the user has permissions) when passed */
  uid?: string;
}

export function DataSourceTitle({ title, uid }: Props) {
  const styles = useStyles2(getStyles);

  if (uid) {
    return <DataSourceEditable title={title} uid={uid} />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'baseline',
      flex: 1,
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    }),
    title: css({
      display: 'inline-block',
      margin: '0 0 0 0',
      maxWidth: '40vw',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    input: css({
      width: '100%',
      maxWidth: '40vw',
    }),
    buttons: css({
      display: 'flex',
      gap: theme.spacing(1),
      position: 'relative',
      top: theme.spacing(0.5),
    }),
  };
};
