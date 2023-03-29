import { css } from '@emotion/css';
import React from 'react';

export const DashboardNotFound = () => {
  return <div className={styles.dashboardLoading}>Dashboard not found.</div>;
};

export const styles = {
  dashboardLoading: css`
    height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
};
