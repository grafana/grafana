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

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  TimelineCollapser: css({
    alignItems: 'center',
    display: 'flex',
    flex: 'none',
    justifyContent: 'center',
    marginRight: '0.5rem',
  }),
  buttonsContainer: css({
    display: 'flex',
    flexDirection: 'row',
    gap: '0.5rem',
    paddingRight: theme.spacing(1),
  }),
  buttonContainer: css({
    display: 'flex',
    alignItems: 'center',
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
      <div className={styles.buttonsContainer}>
        <div className={styles.buttonContainer}>
          <Button
            aria-label={t('explore.timeline-collapser.tooltip-expand', 'Expand +1')}
            tooltip={t('explore.timeline-collapser.tooltip-expand', 'Expand +1')}
            size="sm"
            tooltipPlacement="top"
            icon="angle-down"
            onClick={onExpandOne}
            fill="solid"
            variant="secondary"
          />
          <Button
            aria-label={t('explore.timeline-collapser.tooltip-collapse', 'Collapse +1')}
            tooltip={t('explore.timeline-collapser.tooltip-collapse', 'Collapse +1')}
            size="sm"
            tooltipPlacement="top"
            icon="angle-up"
            onClick={onCollapseOne}
            fill="solid"
            variant="secondary"
          />
        </div>
        <div className={styles.buttonContainer}>
          <Button
            aria-label={t('explore.timeline-collapser.tooltip-expand-all', 'Expand all')}
            tooltip={t('explore.timeline-collapser.tooltip-expand-all', 'Expand all')}
            size="sm"
            tooltipPlacement="top"
            icon="angle-double-down"
            onClick={onExpandAll}
            fill="solid"
            variant="secondary"
          />
          <Button
            aria-label={t('explore.timeline-collapser.tooltip-collapse-all', 'Collapse all')}
            tooltip={t('explore.timeline-collapser.tooltip-collapse-all', 'Collapse all')}
            size="sm"
            tooltipPlacement="top"
            icon="angle-double-up"
            onClick={onCollapseAll}
            fill="solid"
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
