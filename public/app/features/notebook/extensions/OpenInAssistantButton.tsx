import { useMemo } from 'react';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { Button } from '@grafana/ui';

import { notebookViewUrl } from '../api/notebookAPI';
import { resolveCells } from '../model/notebookSpec';

interface Props {
  uid: string;
  spec: NotebookSpec;
}

/**
 * Conversation entry point between a notebook and the Grafana Assistant: opens the
 * assistant with the notebook attached as structured context (content, cells, time
 * range) so the conversation "brings up" the notebook, plus instructions for writing
 * findings back through the exposed `notebooks.*` functions. Renders nothing when
 * the assistant app is not available in this instance.
 */
export function OpenInAssistantButton({ uid, spec }: Props) {
  const { isAvailable, openAssistant } = useAssistant();

  const context = useMemo(() => {
    return [
      createAssistantContextItem('structured', {
        title: `Notebook: ${spec.title}`,
        data: {
          entity: 'grafana-notebook',
          uid,
          title: spec.title,
          url: notebookViewUrl(uid),
          tags: spec.tags,
          timeRange: { from: spec.timeSettings.from, to: spec.timeSettings.to },
          cells: resolveCells(spec).map(summarizeCell),
          writeBack: {
            instructions:
              'To add findings to this notebook, call the exposed assistant functions in the "notebooks" namespace: ' +
              `appendMarkdown({ uid: "${uid}", markdown }) for narrative text, or ` +
              `appendPanel({ uid: "${uid}", title, vizType, datasourceUid, datasourceType, queries }) for a live visualization. ` +
              'Use notebooks.listNotebooks() to discover other notebooks and notebooks.createNotebook({ title, markdown }) to start a new one.',
          },
        },
      }),
    ];
  }, [uid, spec]);

  if (!isAvailable || !openAssistant) {
    return null;
  }

  const label = t('notebooks.assistant.open', 'Ask Assistant');

  // Icon-only keeps the editor toolbar compact; the label lives in the tooltip.
  return (
    <Button
      variant="secondary"
      icon="ai"
      tooltip={label}
      aria-label={label}
      onClick={() =>
        openAssistant({
          origin: 'grafana/notebooks/editor',
          prompt: t(
            'notebooks.assistant.prompt',
            'Help me with the attached notebook "{{title}}" — continue the investigation and add findings to it.',
            { title: spec.title }
          ),
          context,
          autoSend: false,
        })
      }
    />
  );
}

function summarizeCell(cell: ReturnType<typeof resolveCells>[number]) {
  const { element, elementName, source } = cell;

  if (element.kind === 'Panel') {
    const queries = element.spec.data.spec.queries.map((query) => ({
      refId: query.spec.refId,
      datasourceType: query.spec.query.group,
      datasourceUid: query.spec.query.datasource?.name,
      query: query.spec.query.spec,
    }));
    return {
      key: elementName,
      type: 'panel',
      source,
      title: element.spec.title,
      vizType: element.spec.vizConfig.group,
      queries,
    };
  }

  if (element.kind === 'LibraryPanel') {
    return { key: elementName, type: 'library-panel', source, title: element.spec.title };
  }

  const content = element.spec.content;
  if (content.kind === 'Markdown') {
    return { key: elementName, type: 'markdown', source, text: content.spec.text };
  }
  return { key: elementName, type: 'code', source, language: content.spec.language, code: content.spec.code };
}
