import { t } from '@grafana/i18n';
import { Menu, copyTextToClipboard } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_EXPORT_DESTINATION, type NotebookExportSource } from '../analytics/types';
import { type Spec as NotebookSpec } from '../types';
import { notebookShareUrl } from '../urls';

import { downloadMarkdown } from './downloadMarkdown';
import { notebookToMarkdown } from './notebookToMarkdown';
import { canExportNotebookPdf, navigateToNotebookPdf, openBlankNotebookPdfTab } from './openNotebookPdf';

interface Props {
  uid: string;
  /**
   * Resolves the notebook's spec when an action runs, rather than up front. That is the seam letting
   * one menu serve both surfaces: the notebook page hands back its scene's spec synchronously, while
   * a list row fetches — and a list of fifty notebooks must not fetch fifty specs to render.
   */
  getSpec: () => Promise<NotebookSpec | undefined>;
  /**
   * Makes the server's copy of the notebook match what is on screen, awaited by the PDF export
   * alone — it is the only export that goes back through the server, so it is the only one an edit
   * still sitting on autosave's debounce could be missing from. The markdown exports serialize the
   * spec in the browser and already hold every unsaved edit, and making them wait on a save would
   * let one that failed break a copy that never needed the server at all.
   *
   * Optional because a list row has nothing to flush: it holds no scene, and the notebook as the
   * server has it is the only copy it could export in the first place.
   */
  flushPendingChanges?: () => Promise<void>;
  /** Which surface holds this menu, for the exported event. */
  source: NotebookExportSource;
}

/** The export actions, shared by the notebook page toolbar and the list page's row menu. */
export function NotebookExportMenu({ uid, getSpec, flushPendingChanges, source }: Props) {
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

  // Opens a new tab rather than downloading, matching dashboards' PDF export. The tab has to open
  // before the awaits below, not after: both the flush and the row menu's getSpec go over the
  // network, and a window.open past either can easily outlast the click's transient user activation
  // and get treated as an unrequested popup. The spec itself is still needed — not for its content, but
  // because transformNotebookSceneToSaveModel captures whatever time range is currently on screen,
  // including one a reader picked that was never saved — without it the render would fall back to
  // the notebook's last-saved range instead.
  const onExportPdf = async () => {
    const tab = openBlankNotebookPdfTab();
    if (!tab) {
      notifyApp.error(t('notebooks.export.pdf-popup-blocked', 'Your browser blocked the PDF export tab'));
      return;
    }

    try {
      // Before the spec, because this is what makes the notebook the render will load the notebook
      // that is on screen. A failure here aborts the export rather than producing a PDF that is
      // quietly a few seconds out of date.
      await flushPendingChanges?.();
      const spec = await loadSpec();
      navigateToNotebookPdf(tab, uid, spec.timeSettings);
    } catch (error) {
      // Otherwise the reader is left staring at a tab that never goes anywhere.
      tab.close();
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
      {/* Hidden rather than disabled: PDF export needs a headless renderer able to produce one, and
          a plain dropdown item has no room for the explanatory alert a disabled state would need. */}
      {canExportNotebookPdf() && (
        <Menu.Item label={t('notebooks.export.pdf', 'Export as PDF')} icon="file-alt" onClick={onExportPdf} />
      )}
    </>
  );
}
