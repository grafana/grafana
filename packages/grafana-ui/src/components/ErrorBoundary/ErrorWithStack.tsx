import { css } from '@emotion/css';

import { useStyles2 } from '../../themes/ThemeContext';

import { ErrorBoundaryApi } from './ErrorBoundary';

export interface Props extends ErrorBoundaryApi {
  title: string;
}

export const ErrorWithStack = ({ error, errorInfo, title }: Props) => {
  const style = useStyles2(getStyles);

  return (
    <div className={style}>
      <h2>{title}</h2>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        {error && error.toString()}
        <br />
        {errorInfo && errorInfo.componentStack}
      </details>
    </div>
  );
};

ErrorWithStack.displayName = 'ErrorWithStack';

const getStyles = () => {
  return css({
    width: '500px',
    margin: '64px auto',
  });
};
