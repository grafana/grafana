import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { HtmlWithMermaid } from 'app/core/components/HtmlWithMermaid/HtmlWithMermaid';

import { BLOCKS_ATTR } from './pagination';

interface Props {
  html: string;
  className?: string;
  testId?: string;
}

/** Shared by the panel and the edit-time preview so they can't diverge. */
export function TextNGHtmlView({ html, className, testId }: Props) {
  // Not cached: the flag value can change after the providers settle.
  const diagrams = getFeatureFlagClient().getBooleanValue('text.newFeatures', false);

  return (
    <HtmlWithMermaid
      html={html}
      diagrams={diagrams}
      className={className}
      data-testid={testId}
      {...{ [BLOCKS_ATTR]: '' }}
    />
  );
}
