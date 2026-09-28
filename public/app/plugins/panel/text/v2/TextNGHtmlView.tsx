import { css } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useRef } from 'react';

import { useMermaidDiagrams } from 'app/core/hooks/useMermaidDiagrams';

import { BLOCKS_ATTR } from './pagination';
import { isTextNewFeaturesEnabled } from './utils';

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

  useMermaidDiagrams(ref, html, isTextNewFeaturesEnabled());

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
