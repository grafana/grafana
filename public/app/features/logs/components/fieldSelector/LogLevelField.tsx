import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Checkbox, useStyles2 } from '@grafana/ui';

interface Props {
  active: boolean;
  toggle(): void;
}

export function LogLevelField({ active, toggle }: Props): React.JSX.Element | undefined {
  const styles = useStyles2(getStyles);

  const handleChange = useCallback(() => {
    reportInteraction('logs_field_selector_toggle_log_level_clicked', {
      active,
    });
    toggle();
  }, [active, toggle]);

  return (
    <div className={styles.contentWrap}>
      <Checkbox
        className={styles.checkboxLabel}
        label={t('logs.field-selector.log-level', 'Show log level')}
        onChange={handleChange}
        checked={active}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    contentWrap: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }),
    // Hide text that overflows, had to select elements within the Checkbox component, so this is a bit fragile
    checkboxLabel: css({
      '> span': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        maxWidth: '100%',
      },
    }),
  };
}
