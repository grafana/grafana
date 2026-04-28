import { Fragment, type ReactNode } from 'react';

import { type PulseBody, type PulseBodyNode, type PulseMention } from '../types';
import { isSafeUrl } from '../utils/body';

import { MentionChip } from './MentionChip';

interface Props {
  body: PulseBody;
  onMentionClick?: (mention: PulseMention) => void;
}

/**
 * PulseRenderer walks the validated AST and produces React nodes. We
 * never use dangerouslySetInnerHTML here — every node maps to a typed
 * React element so the rendered output cannot execute scripts even if
 * the AST somehow contained a disallowed type (we'd render text-as-text
 * for unknown nodes, which is safe).
 */
export function PulseRenderer({ body, onMentionClick }: Props): ReactNode {
  if (!body || !body.root) {
    return null;
  }
  return <RenderNode node={body.root} onMentionClick={onMentionClick} />;
}

interface NodeProps {
  node: PulseBodyNode;
  onMentionClick?: (mention: PulseMention) => void;
}

function RenderNode({ node, onMentionClick }: NodeProps): ReactNode {
  switch (node.type) {
    case 'root':
      return (
        <>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </>
      );

    case 'paragraph':
      return (
        <p style={{ margin: '0 0 0.5em' }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </p>
      );

    case 'quote':
      return (
        <blockquote style={{ borderLeft: '3px solid currentColor', margin: 0, paddingLeft: '0.75em', opacity: 0.8 }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </blockquote>
      );

    case 'code':
      return (
        <code style={{ background: 'rgba(127,127,127,0.15)', padding: '0 4px', borderRadius: 3 }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </code>
      );

    case 'linebreak':
      return <br />;

    case 'text':
      return <Fragment>{node.text ?? ''}</Fragment>;

    case 'mention':
      if (!node.mention) {
        return null;
      }
      return <MentionChip mention={node.mention} onClick={onMentionClick} />;

    case 'link': {
      const safe = isSafeUrl(node.url ?? '');
      if (!safe) {
        // Render the children as plain text rather than as a link so a
        // malicious URL cannot become a navigable anchor.
        return (
          <Fragment>
            {node.children?.map((c, i) => (
              <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
            ))}
          </Fragment>
        );
      }
      return (
        <a href={safe} target="_blank" rel="noopener noreferrer">
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </a>
      );
    }

    default:
      // Unknown node types degrade to their children rendered as text;
      // never inject HTML.
      return (
        <Fragment>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </Fragment>
      );
  }
}
