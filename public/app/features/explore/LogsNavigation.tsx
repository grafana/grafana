import React, { memo } from 'react';
import { ToolbarButton, Icon } from '@grafana/ui';
import { css } from 'emotion';

function LogsNavigation() {
  const styles = getStyles();
  return (
    <div className={styles.wrapper}>
      <ToolbarButton className={styles.navigationButton}>
        <div className={styles.navigationButtonContent}>
          <Icon name="angle-up" />
          Newer
        </div>
      </ToolbarButton>
      <div className={styles.timeline}>
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
      <div>
        <ToolbarButton className={styles.navigationButton}>
          <div className={styles.navigationButtonContent}>
            Older
            <Icon name="angle-down" />
          </div>
        </ToolbarButton>
        <ToolbarButton className={styles.scrollUpButton} icon="arrow-up" iconOnly={true} />
      </div>
    </div>
  );
}

export default memo(LogsNavigation);

function getStyles() {
  return {
    wrapper: css`
      width: 70px !important;
      padding-left: 7px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `,
    navigationButton: css`
      width: 58px;
      height: 58px;
      line-height: 1;
      padding: 0;
    `,
    navigationButtonContent: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `,
    scrollUpButton: css`
      margin-top: 10px;
      height: 35px;
      width: 35px;
    `,
    timeline: css`
      height: calc(100% - 160px);
      padding-left: 4px;
      div {
        background: #4265f4;
        width: 3px;
        height: calc((100% - 84px) / 5);
        margin: 14px 0;
        &:nth-last-child(-n + 3) {
          background: gray;
        }
      }
    `,
  };
}
