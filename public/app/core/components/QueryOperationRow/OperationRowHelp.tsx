import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  markdown?: string;
  onRemove?: () => void;
}

export const OperationRowHelp = React.memo(
  React.forwardRef<HTMLDivElement, Props>(({ className, children, markdown, onRemove, ...otherProps }, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <div className={cx(styles.wrapper, className)} {...otherProps} ref={ref}>
        {markdown && markdownHelper(markdown)}
        {children}
      </div>
    );
  })
);

function markdownHelper(markdown: string) {
  const helpHtml = renderMarkdown(markdown);
  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />;
}

OperationRowHelp.displayName = 'OperationRowHelp';

const getStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.borderRadius();

  return {
    wrapper: css`
      padding: ${theme.spacing(2)};
      border: 2px solid ${theme.colors.background.secondary};
      border-top: none;
      border-radius: 0 0 ${borderRadius} ${borderRadius};
      position: relative;
      top: -4px;
    `,
  };
};
