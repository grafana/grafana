import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { stylesFactory, useStyles2 } from '../../themes';
import { IconButton } from '../IconButton/IconButton';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Heading of the box */
  heading: string | JSX.Element;
  /** Markdown */
  markdown?: string;
  onRemove?: () => void;
}

export const HelpBox = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    ({ heading, className, children, markdown, onRemove, ...otherProps }, ref) => {
      const styles = useStyles2(getStyles);

      return (
        <div className={cx(styles.wrapper, className)} {...otherProps} ref={ref}>
          <div className={styles.header}>
            <div className={styles.title}>{heading}</div>
            {/* If onRemove is specified, giving preference to onRemove */}
            {onRemove && (
              <div className={styles.close}>
                <IconButton name="times" onClick={onRemove} size="lg" type="button" />
              </div>
            )}
          </div>
          <div className={styles.body}>
            {markdown && markdownHelper(markdown)}
            {children}
          </div>
        </div>
      );
    }
  )
);

function markdownHelper(markdown: string) {
  const helpHtml = renderMarkdown(markdown);
  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />;
}

HelpBox.displayName = 'HelpBox';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.borderRadius();

  return {
    wrapper: css`
      flex-grow: 1;
      position: relative;
      border-radius: ${borderRadius};
      display: flex;
      flex-direction: column;
      align-items: stretch;
      margin-bottom: ${theme.spacing(2)};
    `,
    header: css`
      display: flex;
      flex-direction: row;
      align-items: stretch;
      align-items: center;
      background: ${theme.colors.background.secondary};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    icon: css`
      padding: ${theme.spacing(1)};
      background: ${theme.colors.info.main};
      border-radius: ${borderRadius} 0 0 ${borderRadius};
      color: ${theme.colors.info.contrastText};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    title: css`
      padding: ${theme.spacing(0, 2)};
      flex-grow: 1;
    `,
    close: css`
      padding: ${theme.spacing(1)};
      background: none;
      display: flex;
      align-items: center;
    `,
    body: css`
      padding: ${theme.spacing(2)};
      border: 2px solid ${theme.colors.background.secondary};
      border-radius: 0 0 ${borderRadius} ${borderRadius};
    `,
  };
});
