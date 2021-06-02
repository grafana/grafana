import { css } from 'emotion';

export const styles = {
  actionPanel: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 5px;
  `,
  tableWrapper: css`
    padding: 10px;
    display: flex;
    height: 100%;
    flex-direction: column;

    thead tr th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  `,
  table: css`
    height: 100%;

    & > :first-child {
      height: 100%;
      overflow-y: auto;
      border: none;
    }
  `,
  tableInnerWrapper: css`
    flex: 1;
    overflow: hidden;
  `,
  destructiveButton: css`
    background: rgba(0, 0, 0, 0) linear-gradient(rgb(224, 47, 68) 0%, rgb(196, 22, 42) 100%) repeat scroll 0% 0%;
    color: white;
  `,
  confirmationText: css`
    margin-bottom: 2em;
  `,
};
