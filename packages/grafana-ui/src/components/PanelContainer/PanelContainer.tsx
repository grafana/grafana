import { css, cx } from '@emotion/css';
import { DetailedHTMLProps, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

type Props = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

// TODO: Reimplement this with Box
/** @deprecated Use Box instead */
export const PanelContainer = ({ children, className, ...props }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles, className)} {...props}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    backgroundColor: theme.components.panel.background,
    border: `1px solid ${theme.components.panel.borderColor}`,
    borderRadius: theme.shape.radius.default,
  });
