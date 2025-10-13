import { css } from '@emotion/css';

import { CloudWatchDatasource } from '../../../datasource';

import { LogGroupSelector } from './LegacyLogGroupSelector';

type Props = {
  datasource: CloudWatchDatasource;
  onChange: (logGroups: string[]) => void;
  region: string;
  legacyLogGroupNames: string[];
};

const rowGap = css({
  gap: '3px',
});

export const LegacyLogGroupSelection = ({ datasource, region, legacyLogGroupNames, onChange }: Props) => {
  return (
    <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
      <LogGroupSelector
        region={region}
        selectedLogGroups={legacyLogGroupNames}
        datasource={datasource}
        onChange={onChange}
      />
    </div>
  );
};
