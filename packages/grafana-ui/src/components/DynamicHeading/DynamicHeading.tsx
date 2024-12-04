import { useLayoutEffect, useRef } from 'react';

interface Props extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const DynamicHeading = ({ children, ...restProps }: Props) => {
  const ref = useRef<HTMLHeadingElement>(null);
  const headingTag = useRef<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>('h1');
  useLayoutEffect(() => {
    if (ref === null || ref.current === null) {
      return;
    }

    headingTag.current = getHeadingTag(ref.current);
  });
  const HeadingComponent = headingTag.current;
  return (
    <HeadingComponent ref={ref} {...restProps}>
      {children}
    </HeadingComponent>
  );
};

const getHeadingTag = (el: HTMLHeadingElement): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' => {
  // Get the closest landmark first, then we will likely get a higher level heading
  const contextHeadings = el
    .closest('article, setion, main, aside, nav, header, footer, body')
    ?.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!contextHeadings || contextHeadings.length === 0) {
    // Give h1?
    return 'h1';
  }
  const highestLevel = Math.min(...Array.from(contextHeadings).map((el) => parseInt(el.tagName[1], 10)));

  const newLevel = Math.min(highestLevel + 1, 6); //TODO use aria roles if 6+?

  switch (newLevel) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return `h${newLevel}`;
    default:
      return 'h1';
  }
};
