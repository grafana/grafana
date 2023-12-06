import React, { useCallback, useEffect, useState } from 'react';
import stringSimilarity from 'string-similarity-js';

import { LogRowModel } from '@grafana/data';
import { Button } from '@grafana/ui';

type Props = {
  logLine: string;
  allLogLines: LogRowModel[];
};

export const FindSimilarLogLines = ({ logLine, allLogLines }: Props) => {
  const [similarLines, setSimilarLines] = useState<LogRowModel[]>([]);

  const findSimilar = useCallback(() => {
    const similarLines = allLogLines.map((l) => ({ logRow: l, similarity: stringSimilarity(logLine, l.entry) }));
    setSimilarLines(
      similarLines
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .map((l) => l.logRow)
    );
  }, [logLine, allLogLines]);

  useEffect(() => {
    setSimilarLines([]);
  }, [logLine, allLogLines]);

  return (
    <>
      <Button style={{ margin: '4px 0' }} size="sm" variant="secondary" onClick={() => findSimilar()}>
        Find similar log lines
      </Button>
      {similarLines.length > 0 && (
        <div style={{ margin: '4px 0' }}>
          <h4>Similar log lines</h4>
          {similarLines.map((l) => (
            <div key={l.uid}>
              <pre>{l.entry}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
