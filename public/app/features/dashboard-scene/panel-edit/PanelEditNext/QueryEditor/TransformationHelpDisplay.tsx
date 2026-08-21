import { useState, useEffect } from 'react';

import { renderMarkdown } from '@grafana/data';
import { Drawer } from '@grafana/ui';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { useQueryEditorUIContext } from './QueryEditorContext';

const fallbackHelpHtml = renderMarkdown(FALLBACK_DOCS_LINK);

/**
 * Displays transformation help in a drawer when toggled from the actions menu.
 */
export function TransformationHelpDisplay() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();
  const transformationId = selectedTransformation?.registryItem?.id;
  const [helpContent, setHelpContent] = useState<{ transformationId: string; html: string }>();

  useEffect(() => {
    if (!transformToggles.showHelp || !selectedTransformation?.registryItem) {
      return;
    }

    let cancelled = false;

    const requestedTransformationId = selectedTransformation.registryItem.id;

    getTransformationContent(requestedTransformationId)
      .then(({ helperDocs }) => {
        if (!cancelled) {
          setHelpContent({ transformationId: requestedTransformationId, html: renderMarkdown(helperDocs) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHelpContent({ transformationId: requestedTransformationId, html: fallbackHelpHtml });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transformToggles.showHelp, selectedTransformation?.registryItem]);

  if (!transformToggles.showHelp || !selectedTransformation?.registryItem) {
    return null;
  }

  const helpHtml = helpContent?.transformationId === transformationId ? helpContent.html : fallbackHelpHtml;

  return (
    <Drawer
      title={selectedTransformation.registryItem.name}
      subtitle="Transformation help"
      onClose={transformToggles.toggleHelp}
    >
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />
    </Drawer>
  );
}
