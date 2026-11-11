import { useState, useEffect } from 'react';

import { renderMarkdown } from '@grafana/data';
import { Drawer, MarkdownHTML } from '@grafana/ui';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { useQueryEditorUIContext } from './QueryEditorContext';

/**
 * Displays transformation help in a drawer when toggled from the actions menu.
 */
export function TransformationHelpDisplay() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();
  const [helpHtml, setHelpHtml] = useState<string>(renderMarkdown(FALLBACK_DOCS_LINK));

  useEffect(() => {
    if (!transformToggles.showHelp || !selectedTransformation?.registryItem) {
      return;
    }

    let cancelled = false;

    getTransformationContent(selectedTransformation.registryItem.id)
      .then(({ helperDocs }) => {
        if (!cancelled) {
          setHelpHtml(renderMarkdown(helperDocs));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHelpHtml(renderMarkdown(FALLBACK_DOCS_LINK));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transformToggles.showHelp, selectedTransformation?.registryItem]);

  if (!transformToggles.showHelp || !selectedTransformation?.registryItem) {
    return null;
  }

  return (
    <Drawer
      title={selectedTransformation.registryItem.name}
      subtitle="Transformation help"
      onClose={transformToggles.toggleHelp}
    >
      <MarkdownHTML className="markdown-html" html={helpHtml} />
    </Drawer>
  );
}
