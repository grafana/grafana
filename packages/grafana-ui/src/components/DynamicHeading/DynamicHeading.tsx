import { useLayoutEffect, useRef, useState } from 'react';

interface Props extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const DynamicHeading = ({ children, ...restProps }: Props) => {
  const ref = useRef<HTMLHeadingElement>(null);
  const [headingTag, setHeadingTag] = useState<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>('h1');
  useLayoutEffect(() => {
    if (ref === null || ref.current === null) {
      return;
    }
    const tag = getHeadingTag(ref.current);
    setHeadingTag(tag);
  }, []);

  const HeadingComponent = headingTag;
  return (
    <HeadingComponent ref={ref} {...restProps}>
      {children}
    </HeadingComponent>
  );
};

const getHeadingTag = (element: HTMLHeadingElement): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' => {
  // Get the closest landmark first, then we will likely get a higher level heading
  const contextHeadings = element
    .closest('article, section, main, aside, nav, header, footer, body')
    ?.querySelectorAll('h1, h2, h3, h4, h5, h6');

  // On initial render it finds itself
  if (!contextHeadings || contextHeadings.length <= 1) {
    // Give h1?
    return 'h1';
  }

  const contextHeadingsArray = Array.from(contextHeadings).filter((el) => el !== element);

  const highestLevel = Math.min(...contextHeadingsArray.map((el) => parseInt(el.tagName[1], 10)));

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
