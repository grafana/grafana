import React, { useCallback, useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { Alert, Button, Field, Input, Stack, useStyles2 } from '@grafana/ui';

import { createKind, declaredGroup, deleteKind, listKinds, updateKind } from '../api/kinds';
import { Kind } from '../generated/kind/v1alpha1/kind_object_gen';

interface FormState {
  // The Kind object being edited, or undefined when creating one.
  editing?: Kind;
  name: string;
  apiGroup: string;
  kindName: string;
}

const emptyForm: FormState = { name: '', apiGroup: '', kindName: '' };

function KindsPage() {
  const styles = useStyles2(getStyles);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string>();

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
      setKinds(await listKinds());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    listKinds().then(setKinds, (err) => setError(errorMessage(err)));
  }, []);

  const save = () =>
    run(async () => {
      const spec = { apiGroup: form.apiGroup, name: form.kindName };
      if (form.editing) {
        await updateKind(form.editing, spec);
      } else {
        await createKind(form.name, spec);
      }
      setForm(emptyForm);
    });

  return (
    <PluginPage>
      {error && (
        <Alert title="Request failed" severity="error" onRemove={() => setError(undefined)}>
          {error}
        </Alert>
      )}

      <p>
        Each Kind declares a kind in the namespaced API group{' '}
        <code>&lt;apiGroup&gt;.&lt;namespace&gt;.{'{owner}'}</code>. The plugin&apos;s <code>_manifests</code> route
        lists a manifest for each group, which the Grafana router polls and serves.
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>API group</th>
            <th>Kind</th>
            <th>Served as</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {kinds.map((kind) => (
            <tr key={kind.metadata.name}>
              <td>{kind.metadata.name}</td>
              <td>{kind.spec.apiGroup}</td>
              <td>{kind.spec.name}</td>
              <td>
                <code>
                  /apis/{declaredGroup(kind.spec)}/v1/namespaces/{kind.metadata.namespace}/
                  {kind.spec.name.toLowerCase()}s
                </code>
              </td>
              <td>
                <Stack gap={1} justifyContent="flex-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="pen"
                    onClick={() =>
                      setForm({
                        editing: kind,
                        name: kind.metadata.name,
                        apiGroup: kind.spec.apiGroup,
                        kindName: kind.spec.name,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    icon="trash-alt"
                    onClick={() => run(() => deleteKind(kind.metadata.name))}
                  >
                    Delete
                  </Button>
                </Stack>
              </td>
            </tr>
          ))}
          {kinds.length === 0 && (
            <tr>
              <td colSpan={5}>No kinds yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 className={styles.heading}>{form.editing ? `Edit ${form.editing.metadata.name}` : 'Create a Kind'}</h3>
      <Stack gap={2} alignItems="flex-end" wrap="wrap">
        <Field label="Name" description="The Kind object's name">
          <Input
            value={form.name}
            disabled={!!form.editing}
            placeholder="shop-widget"
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
        </Field>
        <Field label="API group" description="A DNS label, such as shop">
          <Input
            value={form.apiGroup}
            placeholder="shop"
            onChange={(e) => setForm({ ...form, apiGroup: e.currentTarget.value })}
          />
        </Field>
        <Field label="Kind" description="A kind name, such as Widget">
          <Input
            value={form.kindName}
            placeholder="Widget"
            onChange={(e) => setForm({ ...form, kindName: e.currentTarget.value })}
          />
        </Field>
        <Field>
          <Stack gap={1}>
            <Button onClick={save} disabled={!form.name || !form.apiGroup || !form.kindName}>
              {form.editing ? 'Save' : 'Create'}
            </Button>
            {form.editing && (
              <Button variant="secondary" onClick={() => setForm(emptyForm)}>
                Cancel
              </Button>
            )}
          </Stack>
        </Field>
      </Stack>
    </PluginPage>
  );
}

function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: { message?: string } }).data;
    if (data?.message) {
      return data.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    marginBottom: theme.spacing(3),
    'th, td': {
      padding: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      textAlign: 'left',
    },
  }),
  heading: css({
    marginTop: theme.spacing(2),
  }),
});

export default KindsPage;
