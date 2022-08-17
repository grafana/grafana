import React from 'react';
import { DruidHttpSettings, DruidAuthSettings } from './';
import { ConnectionSettingsProps } from './types';

export const DruidConnectionSettings = (props: ConnectionSettingsProps) => {
  return (
    <>
      <DruidHttpSettings {...props} />
      <DruidAuthSettings {...props} />
    </>
  );
};
