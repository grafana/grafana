import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { canDeleteNotebooks } from '../permissions';
import { type Spec as NotebookSpec } from '../types';

/**
 * A notebook's row-level actions. Duplicate still has to slot in alongside these, which is why Export
 * sits in a submenu rather than at the top level.
 *
 * Delete only asks; the row above owns both the confirmation and the request. This menu lives in a
 * Dropdown overlay that unmounts as the menu closes, so a modal opened from here would go with it.
 */
export function NotebookRowMenu({ uid, onDelete }: { uid: string; onDelete: () => void }) {
  const [fetchNotebook] = useLazyGetNotebookQuery();

  const getSpec = async (): Promise<NotebookSpec> => {
    const notebook = await fetchNotebook({ name: uid }).unwrap();
    // The generated client type mirrors the schema spec at runtime (same OpenAPI source); bridge at
    // the fetch seam, as the notebook page state manager does.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec at the fetch seam
    return notebook.spec as unknown as NotebookSpec;
  };

  return (
    <Menu>
      <Menu.Item
        label={t('notebooks.export.label', 'Export')}
        icon="download-alt"
        // The table's rows are flattened and carry no spec, so it is fetched when an action runs
        // rather than for every row on screen.
        childItems={[<NotebookExportMenu key="export" uid={uid} getSpec={getSpec} />]}
      />
      {/* Omitted rather than disabled for a user who cannot delete, as the Edit action beside it is. */}
      {canDeleteNotebooks() && (
        <>
          <Menu.Divider />
          <Menu.Item destructive label={t('notebooks.delete.confirm', 'Delete')} icon="trash-alt" onClick={onDelete} />
        </>
      )}
    </Menu>
  );
}
