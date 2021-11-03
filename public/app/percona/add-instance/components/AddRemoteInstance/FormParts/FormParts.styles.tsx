import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  groupWrapper: css`
    width: 50%;
  `,
  addServiceButton: css`
    margin-top: 30px;
  `,
  sectionHeader: css`
    margin-top: 15px;
    margin-bottom: 15px;
  `,
  // Temporary solution, will be removed after tooltip labels will be added to platform inputs
  labelWrapper: css`
    display: flex;
    font-weight: 500;
    color: rgb(159, 167, 179);
    svg {
      margin-left: ${spacing.xs};
    }
    margin-bottom: ${spacing.xs};
  `,
  urlFieldGroupWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  `,
  urlFieldWrapper: css`
    width: 100%;
    margin-right: 5px;
  `,
});
