import { useMemo, useState } from "react";

import { SpanLinkDef, type SpanLinkFunc } from "../types/links";
import { type TraceSpan } from "../types/trace";

import { SpanLinksMenu } from "./SpanLinks";

interface Props {
  color: string;
  createSpanLink: SpanLinkFunc;
  datasourceType: string;
  span: TraceSpan;
}

export const SpanBarRowLinks = ({ color, createSpanLink, datasourceType, span }: Props) => {
  const [displayedLinks, setDisplayedLinks] = useState<SpanLinkDef[]>([]);

  const links = useMemo(() => createSpanLink(span), [createSpanLink, span]);

  if (!displayedLinks.length) {
    return null;
  }
  if (displayedLinks.length > 1) {
    return <SpanLinksMenu links={displayedLinks} datasourceType={datasourceType} color={color} />;
  }

  return (
    <a
      href={displayedLinks[0].href}
      // Needs to have target otherwise preventDefault would not work due to angularRouter.
      target={'_blank'}
      style={{
        borderBottom: `2px solid ${color}CF`,
        paddingInline: '4px',
      }}
      rel="noopener noreferrer"
      onClick={
        displayedLinks[0].onClick
          ? (event) => {
            if (!(event.ctrlKey || event.metaKey || event.shiftKey) && displayedLinks[0].onClick) {
              event.preventDefault();
              displayedLinks[0].onClick(event);
            }
          }
          : undefined
      }
    >
      {displayedLinks[0].content}
    </a>
  );
}
