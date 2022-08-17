import React from 'react';
import { FieldSet } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { DruidQueryRequestSettings, DruidQueryResponseSettings } from './';
import { QuerySettingsProps } from './types';

export const DruidQuerySettings = (props: QuerySettingsProps) => {
  return (
    <>
      <FieldSet label="Request" className={cx(styles.fieldset)}>
        <DruidQueryRequestSettings {...props} />
      </FieldSet>
      <FieldSet label="Response" className={cx(styles.fieldset)}>
        <DruidQueryResponseSettings {...props} />
      </FieldSet>
    </>
  );
};

const styles = {
  fieldset: css`
    padding-left: 5px;
  `,
};
