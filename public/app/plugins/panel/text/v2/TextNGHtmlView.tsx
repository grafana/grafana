import { css } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useRef } from 'react';

import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { useMermaidDiagrams } from 'app/core/hooks/useMermaidDiagrams';

import { BLOCKS_ATTR } from './pagination';

interface Props {
  html: string;
  className?: string;
  testId?: string;
}

/** Shared by the panel and the edit-time preview so they can't diverge. */
export function TextNGHtmlView({ html, className, testId }: Props) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  // Not cached: the flag value can change after the providers settle.
  useMermaidDiagrams(ref, html, getFeatureFlagClient().getBooleanValue('text.newFeatures', false));

  return (
    // DangerouslySetHtmlContent overwrites any ref it is given, so the hook needs
    // this wrapper; display:contents keeps it from adding a box of its own.
    <div ref={ref} className={styles.host}>
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

const getStyles = () => ({
  host: css({
    display: 'contents',
  }),
});
