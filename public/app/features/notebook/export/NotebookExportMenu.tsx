import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { type Spec as NotebookSpec } from '../types';
import { notebookShareUrl } from '../urls';

import { copyToClipboard } from './copyToClipboard';
import { openCursorPromptDeeplink } from './cursor';
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
}

/** The export actions, shared by the notebook page toolbar and the list page's row menu. */
export function NotebookExportMenu({ uid, getSpec }: Props) {
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
  const reportFailure = () =>
    appEvents.emit(AppEvents.alertError, [t('notebooks.export.error', 'Failed to export notebook')]);

  const onCopy = async () => {
    // Deliberately not awaited here. The clipboard write has to be issued inside the click, so the
    // pending markdown is what gets handed to copyToClipboard — see the note there.
    const markdown = loadSpec().then((spec) => notebookToMarkdown(spec, { url: notebookShareUrl(uid) }));

    try {
      await copyToClipboard(markdown);
      appEvents.emit(AppEvents.alertSuccess, [t('notebooks.export.copied', 'Notebook copied as Markdown')]);
    } catch (error) {
      reportFailure();
    }
  };

  const onDownload = async () => {
    try {
      const spec = await loadSpec();
      // Title from the spec, so the filename always matches the document that was exported.
      downloadMarkdown(notebookToMarkdown(spec, { url: notebookShareUrl(uid) }), spec.title);
    } catch (error) {
      reportFailure();
    }
  };

  const onOpenInCursor = async () => {
    try {
      const spec = await loadSpec();
      // Serialized without the link: Cursor's deep link handler mis-parses embedded URLs, and
      // leaving it out beats generating it and stripping it back out.
      openCursorPromptDeeplink(notebookToMarkdown(spec, {}));
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
      <Menu.Item
        label={t('notebooks.export.open-in-cursor', 'Open in Cursor')}
        icon="external-link-alt"
        onClick={onOpenInCursor}
      />
    </>
  );
}
