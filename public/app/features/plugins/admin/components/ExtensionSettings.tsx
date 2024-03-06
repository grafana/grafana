import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types';

export default function ExtensionSettings(): ReactElement | null {
  const styles = useStyles2(getStyles);
  const navModel = useSelector((state) => getNavModel(state.navIndex, 'extensions'));
  const [activeTab, setActivetab] = useState('settings');
  const tabs = [
    { value: 'settings', label: 'Settings', icon: 'cog' },
    { value: 'explore', label: 'Explore', icon: 'bolt' },
  ];

  return <div>HEY HEY HEY</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  actionBar: css({
    [theme.breakpoints.up('xl')]: {
      marginLeft: 'auto',
    },
  }),
  listWrap: css({
    marginTop: theme.spacing(2),
  }),
  displayAs: css({
    svg: {
      marginRight: 0,
    },
  }),
});
