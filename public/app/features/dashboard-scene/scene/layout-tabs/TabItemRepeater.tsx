import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { MultiValueVariable, sceneGraph } from '@grafana/scenes';
import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';

import { dashboardLog } from '../../utils/utils';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface Props {
  tab: TabItem;
  manager: TabsLayoutManager;
  variable: MultiValueVariable;
}

export function TabItemRepeater({
  tab,
  variable,
}: {
  tab: TabItem;
  manager: TabsLayoutManager;
  variable: MultiValueVariable;
}) {
  const { repeatedTabs } = tab.useState();
  const styles = useStyles2(getStyles);

  if (
    repeatedTabs === undefined ||
    sceneGraph.hasVariableDependencyInLoadingState(variable) ||
    variable.state.loading
  ) {
    dashboardLog.logger('TabItemRepeater', false, 'Variable is loading, showing spinner');
    return (
      <Tooltip content={t('dashboard.tabs-layout.tab.repeat.loading', 'Loading tab repeats')}>
        <div className={styles.spinnerWrapper}>
          <Spinner />
        </div>
      </Tooltip>
    );
  }

  return (
    <>
      <tab.Component model={tab} key={tab.state.key!} />
      {repeatedTabs?.map((tabClone) => (
        <tabClone.Component model={tabClone} key={tabClone.state.key!} />
      ))}
    </>
  );
}

const getStyles = () => ({
  spinnerWrapper: css({
    alignSelf: 'center',
  }),
});
