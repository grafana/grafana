import { type ReactElement } from 'react';

import { Box, Stack } from '@grafana/ui';
import { CodeMirrorDiffEditor as DiffEditor, type CodeMirrorDiffEditorProps } from '@grafana/ui/unstable';

import { InlineDiffToggle, useInlineDiffPreference } from '../MonacoDiffEditor/inlineDiffPreference';

/** Read-only CodeMirror diff with the shared, persisted view preference. */
export function DiffViewer({ height, inline, ...props }: CodeMirrorDiffEditorProps): ReactElement {
  const [inlinePreference, setInlinePreference] = useInlineDiffPreference();
  const inlineDiff = inline ?? inlinePreference;

  return (
    <Stack direction="column" gap={1} minHeight={0} height={height}>
      {inline === undefined && (
        <Stack justifyContent="flex-end" flex="0 0 auto" gap={0}>
          <InlineDiffToggle value={inlineDiff} onChange={setInlinePreference} />
        </Stack>
      )}
      <Box flex="1 1 auto" minHeight={0}>
        <DiffEditor {...props} height="100%" inline={inlineDiff} />
      </Box>
    </Stack>
  );
}
