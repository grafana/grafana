import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { copyStringToClipboard } from 'app/core/utils/explore';

import { type Spec as NotebookSpec } from '../types';
import { notebookShareUrl } from '../urls';

import { openCursorPromptDeeplink, stripNotebookLink } from './cursor';
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
  // The title comes off the spec rather than being passed in, so the filename always matches the
  // document that was actually exported.
  const buildMarkdown = async (): Promise<{ markdown: string; title: string } | undefined> => {
    try {
      const spec = await getSpec();
      if (!spec) {
        throw new Error('Notebook not found');
      }

      return { markdown: notebookToMarkdown(spec, { url: notebookShareUrl(uid) }), title: spec.title };
    } catch (error) {
      // Without this a failed fetch would look like a menu item that does nothing at all.
      appEvents.emit(AppEvents.alertError, [t('notebooks.export.error', 'Failed to export notebook')]);
      return undefined;
    }
  };

  const onCopy = async () => {
    const built = await buildMarkdown();
    if (built) {
      // copyStringToClipboard rather than navigator.clipboard directly: it falls back to
      // document.execCommand outside a secure context, so the copy still works on a plain-http
      // Grafana. It reports no result either way, which is why the toast below is optimistic.
      copyStringToClipboard(built.markdown);
      appEvents.emit(AppEvents.alertSuccess, [t('notebooks.export.copied', 'Notebook copied as Markdown')]);
    }
  };

  const onDownload = async () => {
    const built = await buildMarkdown();
    if (built) {
      downloadMarkdown(built.markdown, built.title);
    }
  };

  const onOpenInCursor = async () => {
    const built = await buildMarkdown();
    if (built) {
      // The link line goes first: Cursor's deep link handler mis-parses embedded URLs.
      openCursorPromptDeeplink(stripNotebookLink(built.markdown));
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
