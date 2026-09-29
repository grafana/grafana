import { t } from '@grafana/i18n';
import { Menu, copyTextToClipboard } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_EXPORT_DESTINATION, type NotebookExportSource } from '../analytics/types';
import { type Spec as NotebookSpec } from '../types';
import { notebookShareUrl } from '../urls';

import { downloadMarkdown } from './downloadMarkdown';
import { notebookToMarkdown } from './notebookToMarkdown';

interface Props {
  uid: string;
  /**
   * Resolves the notebook's spec when an action runs, rather than up front. That is the seam letting
   * one menu serve both surfaces: the notebook page hands back its scene's spec synchronously, while
   * a list row fetches — and a list of fifty notebooks must not fetch fifty specs to render.
   */
  getSpec: () => Promise<NotebookSpec | undefined>;
  /** Which surface holds this menu, for the exported event. */
  source: NotebookExportSource;
}

/** The export actions, shared by the notebook page toolbar and the list page's row menu. */
export function NotebookExportMenu({ uid, getSpec, source }: Props) {
  const notifyApp = useAppNotification();

  // Throws rather than reporting, so each action owns its own outcome: the copy cannot know whether
  // it succeeded until the clipboard write settles, which is after the spec has loaded.
  const loadSpec = async (): Promise<NotebookSpec> => {
    const spec = await getSpec();
    if (!spec) {
      throw new Error('Notebook not found');
    }

    return spec;
  };

  // Without this a failed export would look like a menu item that does nothing at all.
  const reportFailure = () => notifyApp.error(t('notebooks.export.error', 'Failed to export notebook'));

  const onCopy = async () => {
    // Deliberately not awaited here. The clipboard write has to be issued inside the click, so the
    // pending markdown is what gets handed to copyTextToClipboard — see the note there.
    const markdown = loadSpec().then((spec) => notebookToMarkdown(spec, { url: notebookShareUrl(uid) }));
    // A second handle, so a rejection always has a listener. copyTextToClipboard hands the pending
    // promise to ClipboardItem, which never consumes it if the clipboard write rejects first for its
    // own reason — leaving the original handle to surface as an unhandled rejection in the console.
    // The error still reaches the catch below, because that awaits copyTextToClipboard rather than this.
    markdown.catch(() => {});

    try {
      await copyTextToClipboard(markdown);
      NotebookAnalytics.exported(uid, NOTEBOOK_EXPORT_DESTINATION.CLIPBOARD, source);
      notifyApp.success(t('notebooks.export.copied', 'Notebook copied as Markdown'));
    } catch (error) {
      reportFailure();
    }
  };

  const onDownload = async () => {
    try {
      const spec = await loadSpec();
      // Title from the spec, so the filename always matches the document that was exported.
      downloadMarkdown(notebookToMarkdown(spec, { url: notebookShareUrl(uid) }), spec.title);
      NotebookAnalytics.exported(uid, NOTEBOOK_EXPORT_DESTINATION.DOWNLOAD, source);
    } catch (error) {
      reportFailure();
    }
  };

  return (
    <>
      <Menu.Item label={t('notebooks.export.copy-markdown', 'Copy as Markdown')} icon="copy" onClick={onCopy} />
      <Menu.Item
        label={t('notebooks.export.download-markdown', 'Download as .md')}
        icon="download-alt"
        onClick={onDownload}
      />
    </>
  );
}
