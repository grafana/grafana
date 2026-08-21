import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { type Spec as NotebookSpec } from '../types';

/**
 * A notebook's row-level actions. Export is the only one so far; Duplicate and Delete slot in
 * alongside it, which is why Export sits in a submenu rather than at the top level.
 */
export function NotebookRowMenu({ uid }: { uid: string }) {
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
    </Menu>
  );
}
