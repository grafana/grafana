import { css } from '@emotion/css';

export const getStackedLayoutStyles = () => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  }),
  errorAlert: css({
    flex: '0 0 auto',
  }),
});
