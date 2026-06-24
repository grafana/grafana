import { type HTMLAttributes, type ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/navigation-tabs--docs
 */
export const TabContent = ({ children, className, ...restProps }: Props) => {
  return (
    <div {...restProps} className={className}>
      {children}
    </div>
  );
};
