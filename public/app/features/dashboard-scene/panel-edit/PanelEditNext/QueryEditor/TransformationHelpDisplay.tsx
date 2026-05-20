import { useState, useEffect } from 'react';

import { renderMarkdown } from '@grafana/data';
import { Drawer } from '@grafana/ui';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { useQueryEditorUIContext } from './QueryEditorContext';

/**
 * Displays transformation help in a drawer when toggled from the actions menu.
 */
export function TransformationHelpDisplay() {
  const { highlightedTransformation, transformToggles } = useQueryEditorUIContext();
  const [helpHtml, setHelpHtml] = useState<string>(renderMarkdown(FALLBACK_DOCS_LINK));

  useEffect(() => {
    if (!transformToggles.showHelp || !highlightedTransformation?.registryItem) {
      return;
    }

    let cancelled = false;

    getTransformationContent(highlightedTransformation.registryItem.id)
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
  }, [transformToggles.showHelp, highlightedTransformation?.registryItem]);

  if (!transformToggles.showHelp || !highlightedTransformation?.registryItem) {
    return null;
  }

  return (
    <Drawer
      title={highlightedTransformation.registryItem.name}
      subtitle="Transformation help"
      onClose={transformToggles.toggleHelp}
    >
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />
    </Drawer>
  );
}
