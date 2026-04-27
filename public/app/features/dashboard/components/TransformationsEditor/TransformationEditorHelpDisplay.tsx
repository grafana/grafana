import { useEffect, useState } from 'react';

import type { TransformerRegistryItem } from '@grafana/data/transformations';
import { Drawer } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

interface TransformationEditorHelpDisplayProps {
  isOpen: boolean;
  onCloseClick: (value: boolean) => void;
  transformer: TransformerRegistryItem<null>;
}

export const TransformationEditorHelpDisplay = ({
  isOpen,
  onCloseClick,
  transformer,
}: TransformationEditorHelpDisplayProps) => {
  const [helpContent, setHelpContent] = useState<string>(FALLBACK_DOCS_LINK);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    getTransformationContent(transformer.id)
      .then(({ helperDocs }) => {
        if (!cancelled) {
          setHelpContent(helperDocs);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHelpContent(FALLBACK_DOCS_LINK);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, transformer.id]);

  return isOpen ? (
    <Drawer title={transformer.transformation.name} subtitle="Transformation help" onClose={() => onCloseClick(false)}>
      <OperationRowHelp markdown={helpContent} styleOverrides={{ borderTop: '2px solid' }} />
    </Drawer>
  ) : null;
};
