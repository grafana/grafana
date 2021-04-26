// Libraries
import React, { FC } from 'react';
import { css, cx } from '@emotion/css';

// Components
import PageLoader from '../PageLoader/PageLoader';
import { useStyles2 } from '@grafana/ui';
import { GrafanaThemeV2 } from '@grafana/data';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents: FC<Props> = ({ isLoading, children, className }) => {
  const styles = useStyles2(getStyles);
  return <div className={cx(styles, className)}>{isLoading ? <PageLoader /> : children}</div>;
};

const getStyles = (theme: GrafanaThemeV2) => css`
  flex-basis: 100%;
  flex-grow: 1;
  margin-right: auto;
  margin-left: auto;
  max-width: 980px;
  padding: ${theme.spacing(4, 4, 8)};
  width: 100%;
`;
