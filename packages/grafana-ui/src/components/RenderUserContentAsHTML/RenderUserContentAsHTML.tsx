import React, { HTMLAttributes, PropsWithChildren } from 'react';

export interface RenderUserContentAsHTMLProps<T = HTMLSpanElement>
  extends Omit<HTMLAttributes<T>, 'dangerouslySetInnerHTML'> {
  component?: keyof React.ReactHTML;
  content: string;
}

export function RenderUserContentAsHTML<T>({
  component,
  content,
  ...rest
}: PropsWithChildren<RenderUserContentAsHTMLProps<T>>): JSX.Element {
  return React.createElement(component || 'span', {
    dangerouslySetInnerHTML: { __html: content },
    ...rest,
  });
}
