import { css } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';

import { ProfileValue } from './ProfileValue';
import { type ProfileTooltipData } from './types';

export function ProfileTooltipDetails({ data }: { data: ProfileTooltipData }) {
  const styles = useStyles2(getStyles);

  return (
    <p className={styles.lastParagraph}>
      {data.unitTitle}
      <br />
      <ProfileValue label="Total" unitValue={data.unitValue} percentage={data.percentValue} />
      <br />
      <ProfileValue label="Self" unitValue={data.unitSelf} percentage={data.percentSelf} />
      <br />
      Samples: <b>{data.samples}</b>
    </p>
  );
}

const getStyles = () => ({
  lastParagraph: css({
    title: 'lastParagraph',
    marginBottom: 0,
  }),
});
