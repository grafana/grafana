import { css } from '@emotion/css';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { InlineField, Stack, Switch, useStyles2 } from '@grafana/ui';

export interface OverrideSectionProps {
  label: string;
  /** Shown instead of `children` while the override is off. */
  summary: ReactNode;
  /** Whether the caller's value carries an override. Turns the switch on when it becomes true; only the user
   * turns it off, so clearing the last field being edited doesn't collapse the section. */
  overridden: boolean;
  onToggle: (overridden: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}

/** A switch that swaps a default-values summary for the fields that override them. Callers clear
 * their value in `onToggle(false)`, otherwise they'd still persist an override the summary says is gone. */
export function OverrideSection({ label, summary, overridden, onToggle, disabled, children }: OverrideSectionProps) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const [on, setOn] = useState(overridden);

  useEffect(() => {
    if (overridden) {
      setOn(true);
    }
  }, [overridden]);

  return (
    <>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <InlineField label={label} transparent disabled={disabled} className={styles.switchElement}>
          <Switch
            id={id}
            value={on}
            onChange={(e) => {
              const next = e.currentTarget.checked;
              setOn(next);
              onToggle(next);
            }}
          />
        </InlineField>
        {!on && summary}
      </Stack>
      {on && children}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  switchElement: css({
    flexFlow: 'row-reverse',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
});
