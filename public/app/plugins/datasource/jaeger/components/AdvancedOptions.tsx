import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Icon, InlineField, InlineFieldRow, InlineLabel, Input, useStyles } from '@grafana/ui';
import React, { useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { JaegerQuery } from '../types';

const durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';

type Props = {
  query: JaegerQuery;
  onChange: (value: JaegerQuery) => void;
};

export function AdvancedOptions({ query, onChange }: Props) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const styles = useStyles(getStyles);

  return (
    <div>
      <InlineFieldRow>
        <div className={styles.advancedOptionsContainer} onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>
          <InlineLabel as="div">
            Advanced options{' '}
            <Icon className={showAdvancedOptions ? styles.angleUp : styles.angleDown} name="angle-down" />
          </InlineLabel>
        </div>
      </InlineFieldRow>
      <CSSTransition
        in={showAdvancedOptions}
        mountOnEnter={true}
        unmountOnExit={true}
        timeout={300}
        classNames={styles}
      >
        <div>
          <InlineFieldRow>
            <InlineField label="Min Duration" labelWidth={21} grow>
              <Input
                id="minDuration"
                name="minDuration"
                value={query.minDuration || ''}
                placeholder={durationPlaceholder}
                onChange={(v) =>
                  onChange({
                    ...query,
                    minDuration: v.currentTarget.value,
                  })
                }
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Max Duration" labelWidth={21} grow>
              <Input
                id="maxDuration"
                name="maxDuration"
                value={query.maxDuration || ''}
                placeholder={durationPlaceholder}
                onChange={(v) =>
                  onChange({
                    ...query,
                    maxDuration: v.currentTarget.value,
                  })
                }
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Limit" labelWidth={21} grow tooltip="Maximum numbers of returned results">
              <Input
                id="limit"
                name="limit"
                value={query.limit || ''}
                type="number"
                onChange={(v) =>
                  onChange({
                    ...query,
                    limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined,
                  })
                }
              />
            </InlineField>
          </InlineFieldRow>
        </div>
      </CSSTransition>
    </div>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    advancedOptionsContainer: css`
      margin: 0 ${theme.spacing.xs} ${theme.spacing.xs} 0;
      width: 100%;
      cursor: pointer;
    `,
    enter: css`
      label: enter;
      height: 0;
      opacity: 0;
    `,
    enterActive: css`
      label: enterActive;
      height: 108px;
      opacity: 1;
      transition: height 300ms ease, opacity 300ms ease;
    `,
    exit: css`
      label: exit;
      height: 108px;
      opacity: 1;
    `,
    exitActive: css`
      label: exitActive;
      height: 0;
      opacity: 0;
      transition: height 300ms ease, opacity 300ms ease;
    `,
    angleUp: css`
      transform: rotate(-180deg);
      transition: transform 300ms;
    `,
    angleDown: css`
      transform: rotate(0deg);
      transition: transform 300ms;
    `,
  };
}
