import { memo, useRef, useEffect } from 'react';

import { JsonExplorer, JsonExplorerConfig } from './json_explorer/json_explorer'; // We have made some monkey-patching of json-formatter-js so we can't switch right now

interface Props {
  className?: string;
  json: {};
  config?: JsonExplorerConfig;
  open?: number;
  onDidRender?: (formattedJson: {}) => void;
}

export const JSONFormatter = memo<Props>(
  ({ className, json, config = { animateOpen: true }, open = 3, onDidRender }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const wrapperEl = wrapperRef.current;
      if (!wrapperEl) {
        return;
      }

      const formatter = new JsonExplorer(json, open, config);
      const hasChildren = wrapperEl.hasChildNodes();

      if (hasChildren && wrapperEl.lastChild) {
        wrapperEl.replaceChild(formatter.render(), wrapperEl.lastChild);
      } else {
        wrapperEl.appendChild(formatter.render());
      }

      if (onDidRender) {
        onDidRender(formatter.json);
      }
    }, [json, config, open, onDidRender]);

    return <div className={className} ref={wrapperRef} />;
  }
);

JSONFormatter.displayName = 'JSONFormatter';
