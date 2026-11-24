import { css } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Input, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';

/** Saves a value and resolves to whether that succeeded. */
type Save<T> = (value: T) => Promise<boolean>;

interface EditableRowProps<T> {
  label: string;
  value: T;
  /** Why the value cannot be edited here. Shown when the row has no `onSave`. */
  locked?: string;
  /** Omit to make the row read-only. */
  onSave?: Save<T>;
  /** Holds back saving while another save of the same record is in flight. */
  busy?: boolean;
}

interface RowEditor {
  canEdit: boolean;
  editing: boolean;
  pending: boolean;
  canSave: boolean;
  start: () => void;
  cancel: () => void;
  submit: () => void;
}

function useEditor<T>(saved: T, onSave?: Save<T>, busy = false) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [pending, setPending] = useState(false);
  const unchanged = draft === saved;

  const editor: RowEditor = {
    canEdit: !!onSave,
    editing,
    pending,
    canSave: !pending && !unchanged && !busy,
    start: () => {
      setDraft(saved);
      setEditing(true);
    },
    cancel: () => setEditing(false),
    submit: async () => {
      if (!onSave || unchanged) {
        setEditing(false);
        return;
      }
      if (busy) {
        return;
      }
      setPending(true);
      const succeeded = await onSave(draft);
      setPending(false);
      // A failed save keeps the row open, so the value can be corrected and sent again.
      if (succeeded) {
        setEditing(false);
      }
    },
  };
  return { editor, draft, setDraft };
}

export function DetailTable({ children }: { children: ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <table className={styles.table}>
      <tbody>{children}</tbody>
    </table>
  );
}

interface RowProps {
  label: string;
  /** The value as text, shown while the row is not being edited. */
  display?: string;
  locked?: string;
  editor?: RowEditor;
  /** The input shown while the row is being edited. */
  children?: ReactNode;
}

function Row({ label, display, locked, editor, children }: RowProps) {
  const styles = useStyles2(getStyles);

  return (
    <tr className={styles.row}>
      <th scope="row" className={styles.label}>
        {label}
      </th>
      {editor?.editing ? (
        // One cell holds the input and its buttons, so that the buttons wrap below the input on a narrow screen.
        <td colSpan={2} className={styles.value}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              editor.submit();
            }}
          >
            <Stack
              gap={1}
              alignItems="center"
              justifyContent="space-between"
              wrap="wrap"
              // Escape bubbles up from the focused control, so one handler serves every kind of editor.
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  editor.cancel();
                }
              }}
            >
              {children}
              <Stack gap={1}>
                <Button type="submit" disabled={!editor.canSave}>
                  {t('admin.user-overview.save', 'Save')}
                </Button>
                <Button fill="text" disabled={editor.pending} onClick={editor.cancel}>
                  {t('admin.user-overview.cancel', 'Cancel')}
                </Button>
              </Stack>
            </Stack>
          </form>
        </td>
      ) : (
        <>
          <td className={styles.value}>{display || '—'}</td>
          <td className={styles.action}>
            {editor?.canEdit ? (
              <Button
                fill="text"
                aria-label={t('admin.user-overview.edit-field', 'Edit {{field}}', { field: label })}
                onClick={editor.start}
              >
                {t('admin.user-profile.edit-button', 'Edit')}
              </Button>
            ) : (
              locked && <span className={styles.locked}>{locked}</span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

export function DetailRow({ label, value }: { label: string; value?: string }) {
  return <Row label={label} display={value} />;
}

export function TextRow({
  label,
  value,
  type = 'text',
  locked,
  onSave,
  busy,
}: EditableRowProps<string> & { type?: 'text' | 'email' | 'password' }) {
  const styles = useStyles2(getStyles);
  const secret = type === 'password';
  // A password is never shown, so its editor starts empty.
  const { editor, draft, setDraft } = useEditor(secret ? '' : value, onSave, busy);

  return (
    <Row label={label} display={secret ? '••••••••' : value} locked={locked} editor={editor}>
      <Input
        className={styles.input}
        aria-label={label}
        type={type}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        disabled={editor.pending}
        autoFocus
      />
    </Row>
  );
}

export function BooleanRow({ label, value, locked, onSave, busy }: EditableRowProps<boolean>) {
  const { editor, draft, setDraft } = useEditor(value, onSave, busy);
  const yes = t('admin.user-overview.yes', 'Yes');
  const no = t('admin.user-overview.no', 'No');

  return (
    <Row label={label} display={value ? yes : no} locked={locked} editor={editor}>
      <RadioButtonGroup
        options={[
          { label: yes, value: true },
          { label: no, value: false },
        ]}
        value={draft}
        onChange={setDraft}
        disabled={editor.pending}
        autoFocus
      />
    </Row>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
  }),
  row: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    // Rows with an action button are taller than plain rows, so all rows take the taller height.
    height: theme.spacing(6),
  }),
  label: css({
    padding: theme.spacing(1, 4, 1, 1),
    fontWeight: theme.typography.fontWeightMedium,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    // Shrinks the column to its longest label.
    width: '1%',
  }),
  value: css({
    padding: theme.spacing(1),
    overflowWrap: 'anywhere',
  }),
  action: css({
    padding: theme.spacing(1),
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }),
  locked: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  input: css({
    maxWidth: theme.spacing(40),
  }),
});
