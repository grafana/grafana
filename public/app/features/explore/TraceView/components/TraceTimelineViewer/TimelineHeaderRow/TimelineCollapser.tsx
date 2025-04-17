// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';

import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

const getStyles = () => ({
  TimelineCollapser: css({
    alignItems: 'center',
    display: 'flex',
    flex: 'none',
    justifyContent: 'center',
    marginRight: '0.5rem',
  }),
});

type CollapserProps = {
  onCollapseAll: () => void;
  onCollapseOne: () => void;
  onExpandOne: () => void;
  onExpandAll: () => void;
};

export function TimelineCollapser(props: CollapserProps) {
  const { onExpandAll, onExpandOne, onCollapseAll, onCollapseOne } = props;
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.TimelineCollapser} data-testid="TimelineCollapser">
      <IconButton
        tooltip={t('explore.timeline-collapser.tooltip-expand', 'Expand +1')}
        size="xl"
        tooltipPlacement="top"
        name="angle-down"
        onClick={onExpandOne}
      />
      <IconButton
        tooltip={t('explore.timeline-collapser.tooltip-collapse', 'Collapse +1')}
        size="xl"
        tooltipPlacement="top"
        name="angle-right"
        onClick={onCollapseOne}
      />
      <IconButton
        tooltip={t('explore.timeline-collapser.tooltip-expand-all', 'Expand all')}
        size="xl"
        tooltipPlacement="top"
        name="angle-double-down"
        onClick={onExpandAll}
      />
      <IconButton
        tooltip={t('explore.timeline-collapser.tooltip-collapse-all', 'Collapse all')}
        size="xl"
        tooltipPlacement="top"
        name="angle-double-right"
        onClick={onCollapseAll}
      />
    </div>
  );
}
