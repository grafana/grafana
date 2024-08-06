import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';

import { useTheme2 } from '@grafana/ui';

export const MermaidRenderer = ({ source, id }: { source: string; id: string }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const theme = useTheme2();

  useEffect(() => {
    mermaid.mermaidAPI.initialize({
      theme: theme.isDark ? 'dark' : 'default',
      securityLevel: 'loose',
    });
    (async () => {
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = source;
        const { svg, bindFunctions } = await mermaid.mermaidAPI.render(`mermaid-diagram-${id}`, source);
        mermaidRef.current.innerHTML = svg;
        bindFunctions?.(mermaidRef.current);
      }
    })();

    // Clean up mermaid instance when unmounting; doing nothing at the momemt
    return () => { };
  }, [source, theme.isDark, id]);

  return <div id={id} ref={mermaidRef}></div>;
};
