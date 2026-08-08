import { useParams } from 'react-router-dom-v5-compat';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { NotebookEditor } from '../editor/NotebookEditor';

export function NotebookEditorPage() {
  // Routes are registered unconditionally (same as NotebookScenePage), so the
  // feature flag is enforced here.
  const notebooksEnabled = useFlagDashboardNotebooks();
  const { uid } = useParams();

  if (!notebooksEnabled || !uid) {
    return <PageNotFound />;
  }

  return <NotebookEditor uid={uid} />;
}

export default NotebookEditorPage;
