import { renderMarkdown } from '@grafana/data';
import { Drawer } from '@grafana/ui';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';

import { useQueryEditorUIContext } from './QueryEditorContext';

/**
 * Displays transformation help in a drawer when toggled from the actions menu.
 */
export function TransformationHelpDisplay() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();

  if (!transformToggles.showHelp || !selectedTransformation?.registryItem) {
    return null;
  }

  const {
    transformation: { name },
    help,
  } = selectedTransformation.registryItem;

  const helpContent = help ?? FALLBACK_DOCS_LINK;
  const helpHtml = renderMarkdown(helpContent);

  return (
    <Drawer title={name} subtitle="Transformation help" onClose={transformToggles.toggleHelp}>
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />
    </Drawer>
  );
}
