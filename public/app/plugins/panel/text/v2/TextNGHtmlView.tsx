import { css } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useRef } from 'react';

import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { useMermaidDiagrams } from 'app/core/hooks/useMermaidDiagrams';

import { BLOCKS_ATTR } from './pagination';

interface Props {
  html: string;
  className?: string;
  testId?: string;
}

// display:contents keeps the wrapper from adding a box of its own.
const hostStyle = css({ display: 'contents' });

/** Shared by the panel and the edit-time preview so they can't diverge. */
export function TextNGHtmlView({ html, className, testId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Not cached: the flag value can change after the providers settle.
  useMermaidDiagrams(ref, html, getFeatureFlagClient().getBooleanValue('text.newFeatures', false));

  return (
    // DangerouslySetHtmlContent overwrites any ref it is given, so the hook needs this wrapper.
    <div ref={ref} className={hostStyle}>
      <DangerouslySetHtmlContent
        allowRerender
        html={html}
        className={className}
        data-testid={testId}
        {...{ [BLOCKS_ATTR]: '' }}
      />
    </div>
  );
}
